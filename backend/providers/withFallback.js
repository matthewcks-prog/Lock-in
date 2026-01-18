const { logger, trackLlmUsage } = require('../observability');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 2000;
const DEFAULT_MAX_DELAY_MS = 12000;
const DEFAULT_JITTER_RATIO = 0.5;

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

function isRetryableError(error) {
  const status = getStatusCode(error);
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;

  const code = getErrorCode(error);
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT') return true;
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN') return true;

  const message = (getErrorMessage(error) || '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('connection reset') ||
    message.includes('socket hang up')
  );
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
  const {
    operation,
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    jitterRatio,
    shouldRetry,
    logger,
  } = options;

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

async function withRetryAndFallback(primaryFn, fallbackFn, options = {}) {
  const parsedMaxRetries = Number.isFinite(options.maxRetries)
    ? options.maxRetries
    : Number.parseInt(options.maxRetries, 10);
  const maxAttempts = Number.isFinite(parsedMaxRetries)
    ? Math.max(1, parsedMaxRetries)
    : DEFAULT_MAX_ATTEMPTS;

  const config = {
    operation: options.operation || 'llm-request',
    maxAttempts,
    baseDelayMs: options.baseDelayMs || DEFAULT_BASE_DELAY_MS,
    maxDelayMs: options.maxDelayMs || DEFAULT_MAX_DELAY_MS,
    jitterRatio: options.jitterRatio || DEFAULT_JITTER_RATIO,
    shouldRetry: options.shouldRetry || isRetryableError,
    shouldFallback: options.shouldFallback || shouldFallbackForError,
    logger: options.logger || logStructured,
  };

  const primaryProvider = options.primaryProvider || 'primary';
  const fallbackProvider = options.fallbackProvider || 'fallback';
  const model = options.model;
  const requestId = options.requestId;
  const userId = options.userId;

  const startTime = Date.now();

  try {
    const result = await attemptWithRetry(primaryFn, primaryProvider, config);

    // Track LLM usage if result contains token info
    if (result?.usage) {
      trackLlmUsage({
        provider: primaryProvider,
        operation: config.operation,
        model: model || 'unknown',
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        totalTokens: result.usage.total_tokens || 0,
        userId,
        requestId,
        latencyMs: Date.now() - startTime,
      });
    }

    return result;
  } catch (primaryError) {
    if (!fallbackFn || !config.shouldFallback(primaryError)) {
      throw primaryError;
    }

    config.logger('warn', 'Falling back to secondary LLM provider', {
      operation: config.operation,
      primaryProvider,
      fallbackProvider,
      status: getStatusCode(primaryError),
      code: getErrorCode(primaryError),
      message: getErrorMessage(primaryError),
    });

    const result = await attemptWithRetry(fallbackFn, fallbackProvider, config);

    // Track LLM usage for fallback provider
    if (result?.usage) {
      trackLlmUsage({
        provider: fallbackProvider,
        operation: config.operation,
        model: model || 'unknown',
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        totalTokens: result.usage.total_tokens || 0,
        userId,
        requestId,
        latencyMs: Date.now() - startTime,
      });
    }

    return result;
  }
}

module.exports = {
  withRetryAndFallback,
  isRetryableError,
};
