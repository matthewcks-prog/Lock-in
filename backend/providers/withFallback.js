const { logger, trackLlmUsage } = require('../observability');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 2000;
const DEFAULT_MAX_DELAY_MS = 12000;
const DEFAULT_JITTER_RATIO = 0.5;
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'ECONNABORTED',
]);
const RETRYABLE_MESSAGE_FRAGMENTS = [
  'timeout',
  'timed out',
  'connection reset',
  'socket hang up',
  'connection error',
  'network error',
  'fetch failed',
  'econnrefused',
  'socket closed',
  'unable to connect',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(error) {
  return error?.status || error?.response?.status || error?.error?.status || null;
}

function getErrorCode(error) {
  return error?.code || error?.error?.code || null;
}

function getErrorMessage(error) {
  return error?.message || error?.error?.message || String(error);
}

function isRetryableStatus(status) {
  if (status === 429) return true;
  return status >= 500 && status <= 599;
}

function isRetryableCode(code) {
  return code ? RETRYABLE_ERROR_CODES.has(code) : false;
}

function isRetryableMessage(message) {
  const normalized = (message || '').toLowerCase();
  return RETRYABLE_MESSAGE_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function isRetryableError(error) {
  const status = getStatusCode(error);
  if (isRetryableStatus(status)) return true;
  const code = getErrorCode(error);
  if (isRetryableCode(code)) return true;
  return isRetryableMessage(getErrorMessage(error));
}

function shouldFallbackForError(error) {
  if (isRetryableError(error)) {
    return true;
  }

  const status = getStatusCode(error);
  return status === 401 || status === 403 || status === 404;
}

function computeBackoffMs(attempt, baseDelayMs, maxDelayMs, jitterRatio) {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * exponential * jitterRatio;
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Pino-compatible structured log wrapper.
 * Uses the centralized logger from observability module.
 */
function logStructured(level, message, meta) {
  if (logger[level]) {
    logger[level](meta, message);
  } else {
    logger.info(meta, message);
  }
}

async function attemptWithRetry(fn, provider, options) {
  const { operation, maxAttempts, baseDelayMs, maxDelayMs, jitterRatio, shouldRetry, logger } =
    options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error);
      const status = getStatusCode(error);
      const code = getErrorCode(error);

      logger('warn', 'LLM request failed', {
        operation,
        provider,
        attempt,
        maxAttempts,
        retryable,
        status,
        code,
        message: getErrorMessage(error),
      });

      if (!retryable || attempt === maxAttempts) {
        break;
      }

      const backoffMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      logger('info', 'Retrying LLM request', {
        operation,
        provider,
        attempt: attempt + 1,
        backoffMs,
      });
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

function parseMaxAttempts(maxRetries) {
  const parsed = Number.isFinite(maxRetries) ? maxRetries : Number.parseInt(maxRetries, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : DEFAULT_MAX_ATTEMPTS;
}

function buildRetryConfig(options) {
  const maxAttempts = parseMaxAttempts(options.maxRetries);
  return {
    operation: options.operation || 'llm-request',
    maxAttempts,
    baseDelayMs: options.baseDelayMs || DEFAULT_BASE_DELAY_MS,
    maxDelayMs: options.maxDelayMs || DEFAULT_MAX_DELAY_MS,
    jitterRatio: options.jitterRatio || DEFAULT_JITTER_RATIO,
    shouldRetry: options.shouldRetry || isRetryableError,
    shouldFallback: options.shouldFallback || shouldFallbackForError,
    logger: options.logger || logStructured,
  };
}

function trackUsageIfPresent(result, provider, config, meta) {
  if (!result?.usage) return;
  trackLlmUsage({
    provider,
    operation: config.operation,
    model: meta.model || 'unknown',
    promptTokens: result.usage.prompt_tokens || 0,
    completionTokens: result.usage.completion_tokens || 0,
    totalTokens: result.usage.total_tokens || 0,
    userId: meta.userId,
    requestId: meta.requestId,
    latencyMs: Date.now() - meta.startTime,
  });
}

function resolveProviderNames(options) {
  return {
    primary: options.primaryProvider || 'primary',
    fallback: options.fallbackProvider || 'fallback',
  };
}

async function withRetryAndFallback(primaryFn, fallbackFn, options = {}) {
  const config = buildRetryConfig(options);
  const providers = resolveProviderNames(options);
  const meta = {
    model: options.model,
    requestId: options.requestId,
    userId: options.userId,
    startTime: Date.now(),
  };

  try {
    const result = await attemptWithRetry(primaryFn, providers.primary, config);
    trackUsageIfPresent(result, providers.primary, config, meta);
    return result;
  } catch (primaryError) {
    if (!fallbackFn || !config.shouldFallback(primaryError)) {
      throw primaryError;
    }

    config.logger('warn', 'Falling back to secondary LLM provider', {
      operation: config.operation,
      primaryProvider: providers.primary,
      fallbackProvider: providers.fallback,
      status: getStatusCode(primaryError),
      code: getErrorCode(primaryError),
      message: getErrorMessage(primaryError),
    });

    const result = await attemptWithRetry(fallbackFn, providers.fallback, config);
    trackUsageIfPresent(result, providers.fallback, config, meta);
    return result;
  }
}

module.exports = {
  withRetryAndFallback,
  isRetryableError,
};
