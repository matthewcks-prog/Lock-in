const path = require('path');
const {
  upsertTranscriptCache,
  updateTranscriptJob,
} = require('../../repositories/transcriptsRepository');
const { ensureJobDir, cleanupJobFiles } = require('./transcriptFs');
const { assembleUploadFromChunks } = require('./transcriptProcessingAssembly');
const { convertToAudio, splitAudioIfNeeded } = require('./transcriptProcessingAudio');
const { transcribeSegments } = require('./transcriptProcessingTranscription');
const { ensureNotCanceled, normalizeProcessingOptions } = require('./transcriptProcessingUtils');

function enforceDurationLimit(job, options) {
  if (!options.maxMinutes || !job.duration_ms) {
    return;
  }
  const maxMs = options.maxMinutes * 60 * 1000;
  if (job.duration_ms > maxMs) {
    throw new Error(`Video exceeds ${options.maxMinutes} minute limit`);
  }
}

async function cacheTranscriptResult(job, transcript) {
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
}

async function processTranscriptJob(job, options, state) {
  const jobDir = await ensureJobDir(job.id);
  const uploadPath = await assembleUploadFromChunks(job, jobDir, state);
  const effectiveOptions = normalizeProcessingOptions(job, options);

  enforceDurationLimit(job, effectiveOptions);

  const audioPath = path.join(jobDir, 'audio.wav');
  await convertToAudio(uploadPath, audioPath, state);

  const segments = await splitAudioIfNeeded(audioPath, jobDir, state);
  const transcript = await transcribeSegments(segments, effectiveOptions, state);
  ensureNotCanceled(state);

  await cacheTranscriptResult(job, transcript);

  await updateTranscriptJob({
    jobId: job.id,
    userId: job.user_id,
    updates: { status: 'done', error: null },
  });

  await cleanupJobFiles(job.id);
}

module.exports = {
  processTranscriptJob,
};
