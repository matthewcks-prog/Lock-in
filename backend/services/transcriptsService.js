const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { spawn, execSync } = require('child_process');
const { transcribeAudioFile } = require('./transcription');
const {
  claimTranscriptJobForProcessing,
  deleteTranscriptJobChunks,
  getTranscriptJob,
  listTranscriptJobChunkIndices,
  listTranscriptJobsByHeartbeatBefore,
  listTranscriptJobsCreatedBefore,
  updateTranscriptJob,
  upsertTranscriptCache,
  listTranscriptJobsByStatusBefore,
} = require('../repositories/transcriptsRepository');
const {
  TRANSCRIPTION_SEGMENT_MAX_MB,
  TRANSCRIPTION_TEMP_DIR,
  TRANSCRIPT_CHUNK_RETENTION_HOURS,
  TRANSCRIPT_CHUNK_HARD_TTL_DAYS,
  TRANSCRIPT_JOB_TTL_MINUTES,
  TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES,
  TRANSCRIPT_PROCESSING_HEARTBEAT_INTERVAL_SECONDS,
  TRANSCRIPT_PROCESSING_STALE_MINUTES,
} = require('../config');
const { logger } = require('../observability');
const {
  downloadTranscriptChunk,
  removeTranscriptChunks,
  uploadTranscriptChunk,
} = require('./transcriptStorage');

// Industry best practice: Use ffmpeg-static for bundled FFmpeg binary
// This eliminates PATH issues across all platforms
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  logger.info('[Transcripts] Using bundled FFmpeg from ffmpeg-static');
} catch {
  // Fallback to system FFmpeg if ffmpeg-static not installed
  ffmpegPath = 'ffmpeg';
  logger.warn('[Transcripts] ffmpeg-static not found, using system FFmpeg');
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
  logger.warn(
    '[Transcripts] WARNING: FFmpeg not available. AI transcription will not work.\n' +
      '  The bundled ffmpeg-static should work automatically.\n' +
      '  If issues persist, try: npm install ffmpeg-static (in backend folder)',
  );
} else {
  logger.info('[Transcripts] FFmpeg is available and ready');
}

const WORKER_ID = randomUUID();

// Industry best practice: Use MP3 format for Whisper API
// MP3 at 64kbps mono is ~480KB/min vs WAV at ~1.92MB/min (4x smaller)
// OpenAI recommends segments under 25MB, we use 5 minutes (~2.4MB) for reliability
const SEGMENT_DURATION_SECONDS = 300; // 5 minutes - reliable segment size for Whisper

function getJobDir(jobId) {
  return path.join(TRANSCRIPTION_TEMP_DIR, jobId);
}

async function ensureJobDir(jobId) {
  const dir = getJobDir(jobId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

function createProcessingState(job) {
  return {
    jobId: job.id,
    userId: job.user_id,
    cancelRequested: false,
    currentProcess: null,
  };
}

function ensureNotCanceled(state) {
  if (state.cancelRequested) {
    const error = new Error('CANCELED');
    error.code = 'CANCELED';
    throw error;
  }
}

function coerceNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeProcessingOptions(job, options) {
  const fallbackLanguage = typeof job?.language_hint === 'string' ? job.language_hint : null;
  const fallbackMaxMinutes = coerceNumber(job?.max_minutes);
  const maxMinutes = Number.isFinite(options?.maxMinutes) ? options.maxMinutes : fallbackMaxMinutes;

  return {
    languageHint:
      typeof options?.languageHint === 'string' ? options.languageHint : fallbackLanguage,
    maxMinutes,
  };
}

function startProcessingMonitor(state) {
  const intervalMs = Math.max(1, TRANSCRIPT_PROCESSING_HEARTBEAT_INTERVAL_SECONDS) * 1000;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const job = await getTranscriptJob({ jobId: state.jobId, userId: state.userId });
      if (!job) return;

      if (job.status === 'canceled') {
        state.cancelRequested = true;
        if (state.currentProcess) {
          try {
            state.currentProcess.kill('SIGKILL');
          } catch (error) {
            logger.warn({ err: error }, '[Transcripts] Failed to kill ffmpeg process');
          }
        }
        return;
      }

      await updateTranscriptJob({
        jobId: state.jobId,
        userId: state.userId,
        updates: {
          processing_heartbeat_at: new Date().toISOString(),
          processing_worker_id: WORKER_ID,
        },
      });
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Processing heartbeat failed');
    } finally {
      running = false;
    }
  };

  tick().catch((error) => {
    logger.warn({ err: error }, '[Transcripts] Initial processing heartbeat failed');
  });

  const timer = setInterval(() => {
    tick().catch((error) => {
      logger.warn({ err: error }, '[Transcripts] Processing heartbeat failed');
    });
  }, intervalMs);

  return () => clearInterval(timer);
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

async function appendTranscriptChunk({ jobId, userId, chunk, chunkIndex }) {
  if (!userId) {
    throw new Error('Transcript chunk upload requires userId');
  }
  await uploadTranscriptChunk({ userId, jobId, chunkIndex, chunk });
  return { jobId, chunkIndex };
}

async function writeStreamChunk(writeStream, chunk) {
  if (!writeStream.write(chunk)) {
    await new Promise((resolve) => writeStream.once('drain', resolve));
  }
}

async function assembleUploadFromChunks(job, jobDir, state) {
  ensureNotCanceled(state);
  const uploadPath = path.join(jobDir, 'media.bin');
  const chunkIndices = await listTranscriptJobChunkIndices(job.id);

  if (chunkIndices.length === 0) {
    throw new Error('Uploaded media not found for this job');
  }

  if (job.expected_total_chunks) {
    const expectedCount = Number(job.expected_total_chunks);
    if (chunkIndices.length !== expectedCount) {
      throw new Error('Uploaded chunks are incomplete');
    }
  }

  const writeStream = fs.createWriteStream(uploadPath);

  try {
    for (const chunkIndex of chunkIndices) {
      ensureNotCanceled(state);
      const chunk = await downloadTranscriptChunk({
        userId: job.user_id,
        jobId: job.id,
        chunkIndex,
      });
      await writeStreamChunk(writeStream, chunk);
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
    logger.info(
      `[Transcripts] File size ${(stats.size / 1024 / 1024).toFixed(1)}MB - no splitting needed`,
    );
    return [{ path: audioPath, startMs: 0 }];
  }

  logger.info(
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

  logger.info(`[Transcripts] Created ${segments.length} segments for transcription`);
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
    logger.warn({ err: error }, '[Transcripts] Failed to clean up job files');
  }
}

async function processTranscriptJob(job, options, state) {
  const jobDir = await ensureJobDir(job.id);
  const uploadPath = await assembleUploadFromChunks(job, jobDir, state);
  const effectiveOptions = normalizeProcessingOptions(job, options);

  if (effectiveOptions.maxMinutes && job.duration_ms) {
    const maxMs = effectiveOptions.maxMinutes * 60 * 1000;
    if (job.duration_ms > maxMs) {
      throw new Error(`Video exceeds ${effectiveOptions.maxMinutes} minute limit`);
    }
  }

  const audioPath = path.join(jobDir, 'audio.wav');
  await convertToAudio(uploadPath, audioPath, state);

  const segments = await splitAudioIfNeeded(audioPath, jobDir, state);
  const transcript = await transcribeSegments(segments, effectiveOptions, state);
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
}

async function startTranscriptProcessing(job, options) {
  const staleMinutes = Math.max(1, TRANSCRIPT_PROCESSING_STALE_MINUTES);
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const claimedJob = await claimTranscriptJobForProcessing({
    jobId: job.id,
    workerId: WORKER_ID,
    staleBefore,
  });

  if (!claimedJob) {
    logger.info({ jobId: job.id }, '[Transcripts] Job already claimed by another worker');
    return;
  }

  const state = createProcessingState(claimedJob);
  const stopMonitor = startProcessingMonitor(state);

  processTranscriptJob(claimedJob, options, state)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const canceled = message === 'CANCELED' || state.cancelRequested;

      await updateTranscriptJob({
        jobId: claimedJob.id,
        userId: claimedJob.user_id,
        updates: {
          status: canceled ? 'canceled' : 'error',
          error: canceled ? 'Canceled' : message,
        },
      });

      await cleanupJobFiles(claimedJob.id);
    })
    .finally(() => {
      stopMonitor();
    });
}

async function cleanupTranscriptChunksForJob(job, reason) {
  if (!job?.id || !job?.user_id) return { removed: 0 };
  const chunkIndices = await listTranscriptJobChunkIndices(job.id);
  if (chunkIndices.length === 0) return { removed: 0 };

  const batchSize = 100;
  let removed = 0;

  for (let i = 0; i < chunkIndices.length; i += batchSize) {
    const batch = chunkIndices.slice(i, i + batchSize);
    await removeTranscriptChunks({ userId: job.user_id, jobId: job.id, chunkIndices: batch });
    removed += batch.length;
  }

  await deleteTranscriptJobChunks(job.id);
  logger.info({ jobId: job.id, removed, reason }, '[Transcripts] Cleaned up transcript job chunks');

  return { removed };
}

async function cleanupCompletedTranscriptChunks() {
  const retentionMs = Math.max(1, TRANSCRIPT_CHUNK_RETENTION_HOURS) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - retentionMs).toISOString();
  const jobs = await listTranscriptJobsByStatusBefore({
    statuses: ['done', 'error', 'canceled'],
    updatedBefore: cutoff,
  });

  for (const job of jobs) {
    try {
      await cleanupTranscriptChunksForJob(job, 'retention');
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to clean retained job chunks');
    }
  }

  return jobs.length;
}

async function cleanupExpiredTranscriptChunks() {
  const ttlMs = Math.max(1, TRANSCRIPT_CHUNK_HARD_TTL_DAYS) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const jobs = await listTranscriptJobsCreatedBefore({ createdBefore: cutoff });

  for (const job of jobs) {
    try {
      const result = await cleanupTranscriptChunksForJob(job, 'hard-ttl');
      if (
        result.removed > 0 &&
        ['created', 'uploading', 'uploaded', 'processing'].includes(job.status)
      ) {
        await updateTranscriptJob({
          jobId: job.id,
          userId: job.user_id,
          updates: { status: 'error', error: 'Job exceeded retention TTL' },
        });
      }
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to clean expired job chunks');
    }
  }

  return jobs.length;
}

async function resumeStaleTranscriptJobs() {
  const staleMinutes = Math.max(1, TRANSCRIPT_PROCESSING_STALE_MINUTES);
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const staleJobs = await listTranscriptJobsByHeartbeatBefore({
    statuses: ['processing'],
    heartbeatBefore: staleBefore,
  });

  for (const job of staleJobs) {
    try {
      await startTranscriptProcessing(job);
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to resume stale job');
    }
  }

  return staleJobs.length;
}

async function reapStaleTranscriptJobs() {
  const resumed = await resumeStaleTranscriptJobs();
  const ttlMs = Math.max(1, TRANSCRIPT_JOB_TTL_MINUTES) * 60 * 1000;
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const staleJobs = await listTranscriptJobsByStatusBefore({
    statuses: ['created', 'uploading', 'uploaded', 'processing'],
    updatedBefore: cutoff,
  });

  for (const job of staleJobs) {
    try {
      await updateTranscriptJob({
        jobId: job.id,
        userId: job.user_id,
        updates: {
          status: 'error',
          error: 'Job expired before completion',
        },
      });
      await cleanupJobFiles(job.id);
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Failed to mark stale job');
    }
  }

  const cleaned = await cleanupCompletedTranscriptChunks();
  const hardCleaned = await cleanupExpiredTranscriptChunks();

  return {
    reaped: staleJobs.length,
    resumed,
    cleaned,
    hardCleaned,
  };
}

// Track the reaper interval for graceful shutdown
let reaperInterval = null;

function startTranscriptJobReaper() {
  const intervalMs = Math.max(1, TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES) * 60 * 1000;

  reapStaleTranscriptJobs().catch((error) => {
    logger.warn({ err: error }, '[Transcripts] Initial job reaper run failed');
  });

  reaperInterval = setInterval(() => {
    reapStaleTranscriptJobs().catch((error) => {
      logger.warn({ err: error }, '[Transcripts] Job reaper run failed');
    });
  }, intervalMs);

  return () => stopTranscriptJobReaper();
}

function stopTranscriptJobReaper() {
  if (reaperInterval) {
    clearInterval(reaperInterval);
    reaperInterval = null;
  }
}

module.exports = {
  appendTranscriptChunk,
  startTranscriptProcessing,
  reapStaleTranscriptJobs,
  startTranscriptJobReaper,
  stopTranscriptJobReaper,
};
