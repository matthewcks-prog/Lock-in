const { AppError } = require('../../errors');
const { TRANSCRIPT_PROCESSING_STALE_MINUTES } = require('../../config');
const { SIXTY, THOUSAND } = require('../../constants/numbers');
const { coerceNumber } = require('./transcriptJobUtils');
const { JOB_STATUS } = require('./transcriptJobConstants');
const { parseExpectedTotalChunks } = require('./transcriptJobValidation');
const HTTP_STATUS = require('../../constants/httpStatus');

const MINUTES_TO_MILLISECONDS = SIXTY * THOUSAND;

async function updateJobUploadState({
  repo,
  job,
  jobId,
  userId,
  chunkLength,
  expectedTotalChunks,
}) {
  const bytesReceived = Number(job.bytes_received || 0);
  const updates = {
    status: job.status === JOB_STATUS.CREATED ? JOB_STATUS.UPLOADING : job.status,
    error: null,
    bytes_received: bytesReceived + chunkLength,
  };

  if (!job.expected_total_chunks && expectedTotalChunks) {
    updates.expected_total_chunks = expectedTotalChunks;
  }

  const expectedCount = Number(updates.expected_total_chunks ?? job.expected_total_chunks);
  if (Number.isFinite(expectedCount) && expectedCount > 0) {
    const stats = await repo.getTranscriptJobChunkStats(jobId);
    if (
      stats.count === expectedCount &&
      stats.minIndex === 0 &&
      stats.maxIndex === expectedCount - 1
    ) {
      updates.status = JOB_STATUS.UPLOADED;
    }
  }

  await repo.updateTranscriptJob({ jobId, userId, updates });
}

function isProcessingStale(job) {
  if (!TRANSCRIPT_PROCESSING_STALE_MINUTES || !job) return false;
  const cutoff = Date.now() - TRANSCRIPT_PROCESSING_STALE_MINUTES * MINUTES_TO_MILLISECONDS;
  const heartbeat = job.processing_heartbeat_at
    ? new Date(job.processing_heartbeat_at).getTime()
    : null;
  const started = job.processing_started_at ? new Date(job.processing_started_at).getTime() : null;
  const reference = heartbeat ?? started;
  return reference !== null && Number.isFinite(reference) && reference < cutoff;
}

async function resolveFinalizeResponse(repo, job, userId) {
  if (job.status === JOB_STATUS.DONE) {
    const cached = await repo.getTranscriptByFingerprint({
      fingerprint: job.fingerprint,
      userId,
    });
    return {
      success: true,
      job: {
        id: job.id,
        status: JOB_STATUS.DONE,
        transcript: cached?.transcript_json || null,
      },
    };
  }

  if (job.status === JOB_STATUS.CANCELED) {
    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.CANCELED },
    };
  }

  if (job.status === JOB_STATUS.ERROR) {
    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.ERROR, error: job.error || null },
    };
  }

  if (job.status === JOB_STATUS.PROCESSING && !isProcessingStale(job)) {
    return {
      success: true,
      job: { id: job.id, status: JOB_STATUS.PROCESSING },
    };
  }

  return null;
}

function resolveExpectedChunks(job, expectedTotalChunks) {
  return (
    job.expected_total_chunks ??
    (expectedTotalChunks ? parseExpectedTotalChunks(expectedTotalChunks) : null)
  );
}

async function ensureAllChunksPresent(repo, jobId, expectedChunks) {
  if (!expectedChunks) {
    throw new AppError(
      'Expected total chunks not provided.',
      'TRANSCRIPT_TOTAL_CHUNKS_REQUIRED',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  const stats = await repo.getTranscriptJobChunkStats(jobId);
  if (
    stats.count !== expectedChunks ||
    stats.minIndex !== 0 ||
    stats.maxIndex !== expectedChunks - 1
  ) {
    throw new AppError(
      'Upload incomplete: missing chunks.',
      'TRANSCRIPT_MISSING_CHUNKS',
      HTTP_STATUS.BAD_REQUEST,
      {
        expectedTotalChunks: expectedChunks,
        receivedChunks: stats.count,
      },
    );
  }
}

function buildProcessingUpdates(expectedChunks, languageHint, maxMinutes) {
  return {
    status: JOB_STATUS.PROCESSING,
    error: null,
    expected_total_chunks: expectedChunks,
    language_hint: typeof languageHint === 'string' ? languageHint : null,
    max_minutes: coerceNumber(maxMinutes),
  };
}

module.exports = {
  updateJobUploadState,
  resolveFinalizeResponse,
  resolveExpectedChunks,
  ensureAllChunksPresent,
  buildProcessingUpdates,
};
