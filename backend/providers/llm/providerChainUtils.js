const {
  createDeadlineExceededError,
  MIN_REMAINING_MS,
  resolveTimeoutMs,
} = require('./requestBudget');

function getErrorStatus(error) {
  if (!error) return null;
  return (
    error.status ??
    error.statusCode ??
    error.response?.status ??
    error.originalError?.status ??
    error.originalError?.statusCode ??
    null
  );
}

const STATUS_CATEGORY_RULES = [
  { category: 'rate_limit', statuses: new Set([429]) },
  { category: 'auth_error', statuses: new Set([401, 403]) },
  { category: 'bad_request', statuses: new Set([400]) },
];

const MESSAGE_CATEGORY_RULES = [
  { category: 'rate_limit', patterns: ['rate limit', 'quota'] },
  { category: 'auth_error', patterns: ['auth', 'invalid api key'] },
  { category: 'server_error', patterns: ['server error', 'internal'] },
  { category: 'timeout', patterns: ['timeout', 'timed out'] },
  { category: 'network_error', patterns: ['network', 'econnreset', 'socket'] },
  { category: 'bad_request', patterns: ['bad request', 'invalid'] },
];

function normalizeErrorMessage(error) {
  return (error?.message || '').toLowerCase();
}

function attachChainContext(error, errors, startTime) {
  if (!error || typeof error !== 'object') return error;
  error.errors = errors;
  error.latencyMs = Date.now() - startTime;
  error.attemptedProviders = errors.map((e) => e.provider);
  return error;
}

function matchStatusCategory(status) {
  if (typeof status !== 'number') return null;
  for (const rule of STATUS_CATEGORY_RULES) {
    if (rule.statuses.has(status)) {
      return rule.category;
    }
  }
  return null;
}

function matchMessageCategory(message, errorName) {
  if (errorName === 'AbortError') {
    return 'timeout';
  }
  for (const rule of MESSAGE_CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => message.includes(pattern))) {
      return rule.category;
    }
  }
  return null;
}

function categorizeError(error) {
  const status = getErrorStatus(error);
  const message = normalizeErrorMessage(error);

  const statusCategory = matchStatusCategory(status);
  if (statusCategory) {
    return statusCategory;
  }

  if (typeof status === 'number' && status >= 500) {
    return 'server_error';
  }

  const messageCategory = matchMessageCategory(message, error?.name);
  return messageCategory || 'unknown';
}

function resolveProviderBudgetMs(
  remainingMs,
  remainingProviders,
  minRemainingMs = MIN_REMAINING_MS,
) {
  if (!Number.isFinite(remainingMs)) return null;
  if (remainingProviders <= 1) return remainingMs;
  return Math.max(minRemainingMs, Math.floor(remainingMs / remainingProviders));
}

function resolveAttemptTimeoutMs({
  remainingMs,
  remainingProviders,
  optionsTimeoutMs,
  attemptTimeoutMs,
  minRemainingMs = MIN_REMAINING_MS,
}) {
  const providerBudgetMs = resolveProviderBudgetMs(remainingMs, remainingProviders, minRemainingMs);
  const baseTimeoutMs = resolveTimeoutMs(optionsTimeoutMs, attemptTimeoutMs);
  if (!Number.isFinite(remainingMs)) return baseTimeoutMs;
  const candidate = Number.isFinite(baseTimeoutMs)
    ? baseTimeoutMs
    : (providerBudgetMs ?? remainingMs);
  const ceiling = providerBudgetMs ?? remainingMs;
  return Math.min(candidate, ceiling, remainingMs);
}

function resolveQueueTimeoutMs({
  remainingMs,
  remainingProviders,
  optionsQueueTimeoutMs,
  queueTimeoutMs,
  minRemainingMs = MIN_REMAINING_MS,
}) {
  const providerBudgetMs = resolveProviderBudgetMs(remainingMs, remainingProviders, minRemainingMs);
  const baseQueueTimeoutMs = resolveTimeoutMs(optionsQueueTimeoutMs, queueTimeoutMs);
  if (!Number.isFinite(remainingMs)) return baseQueueTimeoutMs;
  const candidate = Number.isFinite(baseQueueTimeoutMs)
    ? baseQueueTimeoutMs
    : (providerBudgetMs ?? remainingMs);
  const ceiling = providerBudgetMs ?? remainingMs;
  return Math.min(candidate, ceiling, remainingMs);
}

function buildDeadlineError(budget, errors, startTime) {
  const error = createDeadlineExceededError(budget?.timeoutMs, budget?.signal?.reason);
  return attachChainContext(error, errors, startTime);
}

module.exports = {
  MIN_REMAINING_MS,
  attachChainContext,
  buildDeadlineError,
  categorizeError,
  getErrorStatus,
  resolveAttemptTimeoutMs,
  resolveQueueTimeoutMs,
  resolveProviderBudgetMs,
};
