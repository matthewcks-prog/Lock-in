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

module.exports = {
  createProcessingState,
  ensureNotCanceled,
  coerceNumber,
  normalizeProcessingOptions,
};
