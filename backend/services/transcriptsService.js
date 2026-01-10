const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { transcribeAudioFile } = require('../openaiClient');
const {
  updateTranscriptJob,
  upsertTranscriptCache,
  listTranscriptJobsByStatusBefore,
} = require('../repositories/transcriptsRepository');
const {
  TRANSCRIPTION_SEGMENT_MAX_MB,
  TRANSCRIPTION_TEMP_DIR,
  TRANSCRIPT_JOB_TTL_MINUTES,
  TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES,
} = require('../config');

// Industry best practice: Use ffmpeg-static for bundled FFmpeg binary
// This eliminates PATH issues across all platforms
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  console.log('[Transcripts] Using bundled FFmpeg from ffmpeg-static');
} catch {
  // Fallback to system FFmpeg if ffmpeg-static not installed
  ffmpegPath = 'ffmpeg';
  console.log('[Transcripts] ffmpeg-static not found, using system FFmpeg');
}

// Check if ffmpeg is available on startup
function checkFfmpegAvailable() {
  try {
    execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

const FFMPEG_AVAILABLE = checkFfmpegAvailable();
if (!FFMPEG_AVAILABLE) {
  console.warn(
    '[Transcripts] WARNING: FFmpeg not available. AI transcription will not work.\n' +
      '  The bundled ffmpeg-static should work automatically.\n' +
      '  If issues persist, try: npm install ffmpeg-static (in backend folder)',
  );
} else {
  console.log('[Transcripts] FFmpeg is available and ready');
}

const ACTIVE_JOBS = new Map();

// Industry best practice: Use MP3 format for Whisper API
// MP3 at 64kbps mono is ~480KB/min vs WAV at ~1.92MB/min (4x smaller)
// OpenAI recommends segments under 25MB, we use 5 minutes (~2.4MB) for reliability
const SEGMENT_DURATION_SECONDS = 300; // 5 minutes - reliable segment size for Whisper

function getJobDir(jobId) {
  return path.join(TRANSCRIPTION_TEMP_DIR, jobId);
}

function getChunksDir(jobId) {
  return path.join(getJobDir(jobId), 'chunks');
}

function getChunkFilename(chunkIndex) {
  const safeIndex = Number.isFinite(chunkIndex) ? chunkIndex : 0;
  const padded = String(safeIndex).padStart(6, '0');
  return `chunk-${padded}.bin`;
}

function getChunkPath(jobId, chunkIndex) {
  return path.join(getChunksDir(jobId), getChunkFilename(chunkIndex));
}

async function ensureJobDir(jobId) {
  const dir = getJobDir(jobId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

function getJobState(jobId) {
  if (!ACTIVE_JOBS.has(jobId)) {
    ACTIVE_JOBS.set(jobId, {
      cancelRequested: false,
      currentProcess: null,
      uploadPath: null,
      processing: false,
    });
  }
  return ACTIVE_JOBS.get(jobId);
}

function ensureNotCanceled(state) {
  if (state.cancelRequested) {
    const error = new Error('CANCELED');
    error.code = 'CANCELED';
    throw error;
  }
}

function runFfmpeg(args, state) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    state.currentProcess = proc;
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      state.currentProcess = null;
      // Provide helpful error message when ffmpeg is not found
      if (err.code === 'ENOENT') {
        const helpfulError = new Error(
          'FFmpeg not found. Try reinstalling: npm install ffmpeg-static (in backend folder)',
        );
        helpfulError.code = 'FFMPEG_NOT_FOUND';
        reject(helpfulError);
        return;
      }
      reject(err);
    });

    proc.on('close', (code) => {
      state.currentProcess = null;
      if (state.cancelRequested) {
        return reject(new Error('CANCELED'));
      }
      if (code === 0) {
        return resolve();
      }
      const message = stderr.trim() || `ffmpeg exited with code ${code}`;
      return reject(new Error(message));
    });
  });
}

async function appendTranscriptChunk(jobId, chunk, chunkIndex) {
  const state = getJobState(jobId);
  const jobDir = await ensureJobDir(jobId);
  const chunksDir = getChunksDir(jobId);
  await fs.promises.mkdir(chunksDir, { recursive: true });
  const chunkPath = getChunkPath(jobId, chunkIndex);

  if (!fs.existsSync(chunkPath)) {
    await fs.promises.writeFile(chunkPath, chunk);
  }

  state.uploadPath = path.join(jobDir, 'media.bin');
  return chunkPath;
}

async function assembleUploadFromChunks(job, jobDir, state) {
  ensureNotCanceled(state);
  const chunksDir = getChunksDir(job.id);
  const uploadPath = path.join(jobDir, 'media.bin');

  const files = await fs.promises.readdir(chunksDir);
  const chunkFiles = files
    .filter((file) => file.startsWith('chunk-') && file.endsWith('.bin'))
    .sort();

  if (chunkFiles.length === 0) {
    throw new Error('Uploaded media not found for this job');
  }

  if (job.expected_total_chunks) {
    const expectedCount = Number(job.expected_total_chunks);
    if (chunkFiles.length !== expectedCount) {
      throw new Error('Uploaded chunks are incomplete');
    }
  }

  const writeStream = fs.createWriteStream(uploadPath);

  try {
    for (const file of chunkFiles) {
      ensureNotCanceled(state);
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(path.join(chunksDir, file));
        readStream.on('error', reject);
        readStream.on('end', resolve);
        readStream.pipe(writeStream, { end: false });
      });
    }
  } finally {
    writeStream.end();
  }

  return uploadPath;
}

/**
 * Convert input media to MP3 format optimized for Whisper API.
 * Uses 64kbps mono audio - ideal balance of quality and file size.
 * A 1-hour video becomes ~30MB MP3 vs ~230MB WAV.
 */
async function convertToAudio(inputPath, outputPath, state) {
  ensureNotCanceled(state);
  // Use MP3 format: much smaller files, faster uploads, same transcription quality
  // -ac 1: mono audio (speech is mono)
  // -ar 16000: 16kHz sample rate (Whisper's native rate)
  // -b:a 64k: 64kbps bitrate (good for speech)
  await runFfmpeg(
    [
      '-y',
      '-i',
      inputPath,
      '-vn', // No video
      '-ac',
      '1', // Mono
      '-ar',
      '16000', // 16kHz
      '-b:a',
      '64k', // 64kbps
      '-f',
      'mp3',
      outputPath,
    ],
    state,
  );
}

/**
 * Split audio into segments for reliable transcription.
 * Uses time-based splitting (5 min segments) rather than size-based.
 * Each segment is under 3MB, well within OpenAI's 25MB limit.
 */
async function splitAudioIfNeeded(audioPath, jobDir, state) {
  ensureNotCanceled(state);
  const stats = await fs.promises.stat(audioPath);

  // For small files (< 20MB), no need to split
  const SMALL_FILE_THRESHOLD = 20 * 1024 * 1024;
  if (stats.size <= SMALL_FILE_THRESHOLD) {
    console.log(
      `[Transcripts] File size ${(stats.size / 1024 / 1024).toFixed(1)}MB - no splitting needed`,
    );
    return [{ path: audioPath, startMs: 0 }];
  }

  console.log(
    `[Transcripts] File size ${(stats.size / 1024 / 1024).toFixed(
      1,
    )}MB - splitting into ${SEGMENT_DURATION_SECONDS / 60} minute segments`,
  );
  const segmentsDir = path.join(jobDir, 'segments');
  await fs.promises.mkdir(segmentsDir, { recursive: true });
  const outputPattern = path.join(segmentsDir, 'segment-%03d.mp3');

  await runFfmpeg(
    [
      '-y',
      '-i',
      audioPath,
      '-vn',
      '-f',
      'segment',
      '-segment_time',
      String(SEGMENT_DURATION_SECONDS),
      '-reset_timestamps',
      '1',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k', // MP3 at 64kbps
      outputPattern,
    ],
    state,
  );

  const files = await fs.promises.readdir(segmentsDir);
  const segments = files
    .filter((file) => file.startsWith('segment-') && file.endsWith('.mp3'))
    .sort()
    .map((file, index) => ({
      path: path.join(segmentsDir, file),
      startMs: index * SEGMENT_DURATION_SECONDS * 1000,
    }));

  console.log(`[Transcripts] Created ${segments.length} segments for transcription`);
  return segments;
}

async function transcribeSegments(segments, options, state) {
  const mergedSegments = [];
  const textParts = [];

  for (const segment of segments) {
    ensureNotCanceled(state);
    const response = await transcribeAudioFile({
      filePath: segment.path,
      language: options?.languageHint,
    });

    const responseSegments = Array.isArray(response?.segments) ? response.segments : [];

    if (responseSegments.length === 0 && typeof response?.text === 'string') {
      const fallbackText = response.text.trim();
      if (fallbackText) {
        mergedSegments.push({
          startMs: segment.startMs,
          endMs: segment.startMs,
          text: fallbackText,
        });
        textParts.push(fallbackText);
      }
      continue;
    }

    for (const cue of responseSegments) {
      const text = typeof cue.text === 'string' ? cue.text.trim() : '';
      if (!text) continue;

      const startMs = segment.startMs + Math.round((cue.start || 0) * 1000);
      const endMs = segment.startMs + Math.round((cue.end || 0) * 1000);
      mergedSegments.push({ startMs, endMs, text });
      textParts.push(text);
    }
  }

  const plainText = textParts.join('\n');
  const durationMs =
    mergedSegments.length > 0 ? mergedSegments[mergedSegments.length - 1].endMs : undefined;

  return {
    plainText,
    segments: mergedSegments,
    durationMs,
  };
}

async function cleanupJobFiles(jobId) {
  const dir = getJobDir(jobId);
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn('[Transcripts] Failed to clean up job files:', error);
  }
}

async function processTranscriptJob(job, options, state) {
  const jobDir = await ensureJobDir(job.id);
  const uploadPath = await assembleUploadFromChunks(job, jobDir, state);
  state.uploadPath = uploadPath;

  if (options?.maxMinutes && job.duration_ms) {
    const maxMs = options.maxMinutes * 60 * 1000;
    if (job.duration_ms > maxMs) {
      throw new Error(`Video exceeds ${options.maxMinutes} minute limit`);
    }
  }

  const audioPath = path.join(jobDir, 'audio.wav');
  await convertToAudio(uploadPath, audioPath, state);

  const segments = await splitAudioIfNeeded(audioPath, jobDir, state);
  const transcript = await transcribeSegments(segments, options, state);
  ensureNotCanceled(state);

  // Redact media URL for privacy (remove session tokens, auth params)
  // Keep normalized version for cache lookups
  const mediaUrlRedacted = '[REDACTED_FOR_PRIVACY]';

  await upsertTranscriptCache({
    userId: job.user_id,
    fingerprint: job.fingerprint,
    provider: job.provider || 'openai',
    mediaUrlRedacted,
    mediaUrlNormalized: job.media_url_normalized,
    etag: null,
    lastModified: null,
    durationMs: job.duration_ms,
    transcriptJson: transcript,
  });

  await updateTranscriptJob({
    jobId: job.id,
    userId: job.user_id,
    updates: { status: 'done', error: null },
  });

  await cleanupJobFiles(job.id);
  ACTIVE_JOBS.delete(job.id);
}

async function startTranscriptProcessing(job, options) {
  const state = getJobState(job.id);
  if (state.processing) return;
  state.processing = true;

  processTranscriptJob(job, options, state)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const canceled = message === 'CANCELED' || state.cancelRequested;

      await updateTranscriptJob({
        jobId: job.id,
        userId: job.user_id,
        updates: {
          status: canceled ? 'canceled' : 'error',
          error: canceled ? 'Canceled' : message,
        },
      });

      await cleanupJobFiles(job.id);
      ACTIVE_JOBS.delete(job.id);
    })
    .finally(() => {
      state.processing = false;
    });
}

async function cancelTranscriptProcessing(jobId) {
  const state = getJobState(jobId);
  state.cancelRequested = true;
  if (state.currentProcess) {
    try {
      state.currentProcess.kill('SIGKILL');
    } catch (error) {
      console.warn('[Transcripts] Failed to kill ffmpeg process:', error);
    }
  }
  await cleanupJobFiles(jobId);
  ACTIVE_JOBS.delete(jobId);
}

async function reapStaleTranscriptJobs() {
  const ttlMs = Math.max(1, TRANSCRIPT_JOB_TTL_MINUTES) * 60 * 1000;
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const staleJobs = await listTranscriptJobsByStatusBefore({
    statuses: ['created', 'uploading', 'uploaded', 'processing'],
    updatedBefore: cutoff,
  });

  if (staleJobs.length === 0) return { reaped: 0 };

  for (const job of staleJobs) {
    try {
      await cancelTranscriptProcessing(job.id);
    } catch (error) {
      console.warn('[Transcripts] Failed to cancel stale job process:', error);
    }

    try {
      await updateTranscriptJob({
        jobId: job.id,
        userId: job.user_id,
        updates: {
          status: 'error',
          error: 'Job expired before completion',
        },
      });
    } catch (error) {
      console.warn('[Transcripts] Failed to mark stale job:', error);
    }
  }

  return { reaped: staleJobs.length };
}

function startTranscriptJobReaper() {
  const intervalMs = Math.max(1, TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES) * 60 * 1000;

  reapStaleTranscriptJobs().catch((error) => {
    console.warn('[Transcripts] Initial job reaper run failed:', error);
  });

  const timer = setInterval(() => {
    reapStaleTranscriptJobs().catch((error) => {
      console.warn('[Transcripts] Job reaper run failed:', error);
    });
  }, intervalMs);

  return () => clearInterval(timer);
}

module.exports = {
  appendTranscriptChunk,
  startTranscriptProcessing,
  cancelTranscriptProcessing,
  reapStaleTranscriptJobs,
  startTranscriptJobReaper,
};
