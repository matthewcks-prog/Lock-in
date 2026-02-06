const { AppError, ValidationError } = require('../../errors');
const { TRANSCRIPT_CHUNK_MAX_BYTES } = require('../../config');
const { coerceNumber } = require('./transcriptJobUtils');
const { JOB_STATUS, UPLOADABLE_STATUSES } = require('./transcriptJobConstants');

function parseExpectedTotalChunks(rawValue) {
  const value = coerceNumber(rawValue);
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError('Expected total chunks must be a positive integer', 'x-total-chunks');
  }
  return value;
}

function ensureValidChunkIndex(chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new ValidationError('Chunk index must be a non-negative integer', 'x-chunk-index');
  }
}

function parseChunkHeaders(headers) {
  return {
    chunkIndex: coerceNumber(headers?.['x-chunk-index']),
    expectedTotalChunks: parseExpectedTotalChunks(headers?.['x-total-chunks']),
  };
}

function ensureValidUploadPayload(jobId, chunk, chunkIndex) {
  if (!jobId) {
    throw new ValidationError('Job ID is required', 'id');
  }
  if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
    throw new ValidationError('Chunk payload is required', 'chunk');
  }
  if (Number.isFinite(TRANSCRIPT_CHUNK_MAX_BYTES) && chunk.length > TRANSCRIPT_CHUNK_MAX_BYTES) {
    throw new AppError('Chunk exceeds maximum allowed size.', 'TRANSCRIPT_CHUNK_TOO_LARGE', 413, {
      maxBytes: TRANSCRIPT_CHUNK_MAX_BYTES,
    });
  }
  if (chunkIndex === null) {
    throw new ValidationError('Chunk index header is required', 'x-chunk-index');
  }
  ensureValidChunkIndex(chunkIndex);
}

function ensureJobUploadable(job) {
  if (job.status === JOB_STATUS.CANCELED) {
    throw new AppError('This transcription job has been canceled.', 'TRANSCRIPT_CANCELED', 409);
  }
  if (!UPLOADABLE_STATUSES.has(job.status)) {
    throw new AppError('Job is no longer accepting chunks.', 'TRANSCRIPT_INVALID_STATE', 409);
  }
}

function ensureChunkIndexInRange(job, chunkIndex, expectedTotalChunks) {
  if (job.expected_total_chunks && chunkIndex >= Number(job.expected_total_chunks)) {
    throw new AppError(
      'Chunk index exceeds expected total chunks.',
      'TRANSCRIPT_CHUNK_OUT_OF_RANGE',
      400,
    );
  }
  if (
    expectedTotalChunks &&
    job.expected_total_chunks &&
    expectedTotalChunks !== Number(job.expected_total_chunks)
  ) {
    throw new AppError(
      'Expected total chunks header does not match job configuration.',
      'TRANSCRIPT_TOTAL_CHUNKS_MISMATCH',
      409,
    );
  }
}

module.exports = {
  parseExpectedTotalChunks,
  ensureValidChunkIndex,
  parseChunkHeaders,
  ensureValidUploadPayload,
  ensureJobUploadable,
  ensureChunkIndexInRange,
};
