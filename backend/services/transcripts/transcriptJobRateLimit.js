const { AppError } = require('../../errors');
const { TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE } = require('../../config');

async function enforceUploadRateLimit(repo, userId, bytes) {
  if (!userId || !Number.isFinite(TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE)) return;
  const limit =
    Number.isFinite(TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE) && TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE > 0
      ? TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE
      : null;
  if (!limit) return;

  const result = await repo.consumeTranscriptUploadBytes({ userId, bytes, limit });
  if (!result.allowed) {
    throw new AppError(
      'Upload rate limit exceeded. Please wait before uploading more.',
      'TRANSCRIPT_RATE_LIMIT',
      429,
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }
}

module.exports = {
  enforceUploadRateLimit,
};
