const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { transcribeAudioFile } = require('./transcriptionService');
const {
  claimTranscriptJobForProcessing,
  getTranscriptJob,
  listTranscriptJobChunkIndices,
  updateTranscriptJob,
  upsertTranscriptCache,
} = require('../../repositories/transcriptsRepository');
const {
  TRANSCRIPT_PROCESSING_HEARTBEAT_INTERVAL_SECONDS,
  TRANSCRIPT_PROCESSING_STALE_MINUTES,
} = require('../../config');
const { logger } = require('../../observability');
const { downloadTranscriptChunk, uploadTranscriptChunk } = require('./transcriptStorage');
const { ensureJobDir, cleanupJobFiles } = require('./transcriptFs');
const { runFfmpeg, SEGMENT_DURATION_SECONDS } = require('./transcriptFfmpeg');

const WORKER_ID = randomUUID();

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
 */
async function convertToAudio(inputPath, outputPath, state) {
  ensureNotCanceled(state);
  await runFfmpeg(
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
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
 */
async function splitAudioIfNeeded(audioPath, jobDir, state) {
  ensureNotCanceled(state);
  const stats = await fs.promises.stat(audioPath);

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
      '64k',
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

module.exports = {
  appendTranscriptChunk,
  startTranscriptProcessing,
};
