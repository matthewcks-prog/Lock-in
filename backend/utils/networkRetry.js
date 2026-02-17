const { TimeoutError, AbortError } = require('../errors');

const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_SERVER_ERROR_MIN = 500;
const RETRY_AFTER_HEADER = 'retry-after';
const RETRY_JITTER_RATIO = 0.3;
const REQUEST_ABORTED_MESSAGE = 'Request aborted';
const REQUEST_FAILED_MESSAGE = 'Request failed';
const REQUEST_FAILED_AFTER_RETRIES_MESSAGE = 'Request failed after retries';
const TIMEOUT_ERROR_CODE = 'TIMEOUT';
const ABORTED_ERROR_CODE = 'ABORTED';

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  timeoutMs: 30000,
  retryableStatuses: [HTTP_STATUS_TOO_MANY_REQUESTS],
  retryOnServerError: true,
  retryOnNetworkError: true,
  retryOnTimeout: true,
};

function normalizeConfig(overrides) {
  if (!overrides) {
    return { ...DEFAULT_RETRY_CONFIG };
  }
  const retryableStatuses = Array.isArray(overrides.retryableStatuses)
    ? overrides.retryableStatuses
    : DEFAULT_RETRY_CONFIG.retryableStatuses;
  return { ...DEFAULT_RETRY_CONFIG, ...overrides, retryableStatuses };
}

function resolveFetcher(config) {
  const fetcher = config.fetcher || global.fetch;
  if (typeof fetcher !== 'function') {
    throw new Error('Fetch implementation is required.');
  }
  return fetcher;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateRetryDelay(attempt, config) {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * (Math.random() * RETRY_JITTER_RATIO);
  return Math.floor(cappedDelay + jitter);
}

function parseRetryAfterMs(response) {
  const value = response.headers?.get?.(RETRY_AFTER_HEADER);
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function isRetryableStatus(status, config) {
  if (
    status === HTTP_STATUS_UNAUTHORIZED ||
    status === HTTP_STATUS_FORBIDDEN ||
    status === HTTP_STATUS_NOT_FOUND
  ) {
    return false;
  }
  if (config.retryableStatuses.includes(status)) {
    return true;
  }
  return config.retryOnServerError && status >= HTTP_STATUS_SERVER_ERROR_MIN;
}

function isNetworkError(error) {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('ERR_NETWORK') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EAI_AGAIN')
  );
}

function createTimeoutError(timeoutMs, context) {
  const label = context ? `${context} ` : '';
  return new TimeoutError(`${label}timed out after ${timeoutMs}ms`, {
    timeoutMs,
    context: context ?? null,
  });
}

function isAbortError(error) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.code === ABORTED_ERROR_CODE ||
      error.code === 'ABORT_ERR' ||
      error.code === 'ERR_ABORTED')
  );
}

function shouldRetryError(error, config) {
  if (!error) {
    return false;
  }
  if (error.code === TIMEOUT_ERROR_CODE) {
    return config.retryOnTimeout;
  }
  if (error.code === ABORTED_ERROR_CODE) {
    return false;
  }
  return isNetworkError(error) && config.retryOnNetworkError;
}

function createAttemptController(optionsSignal, timeoutMs) {
  let timeoutId;
  let timedOut = false;
  const controller = new AbortController();
  const abortFromSignal = () => controller.abort();

  if (optionsSignal) {
    if (optionsSignal.aborted) {
      controller.abort();
    } else {
      optionsSignal.addEventListener('abort', abortFromSignal, { once: true });
    }
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (optionsSignal) {
        optionsSignal.removeEventListener('abort', abortFromSignal);
      }
    },
  };
}

function normalizeAttemptError(error, { timedOut, timeoutMs, context }) {
  if (isAbortError(error) && timedOut) {
    return createTimeoutError(timeoutMs, context);
  }
  if (isAbortError(error)) {
    return new AbortError(REQUEST_ABORTED_MESSAGE);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function createHttpStatusError(response) {
  return new Error(`HTTP ${response.status}: ${response.statusText}`);
}

async function performAttempt({ url, options, config, fetcher }) {
  const attemptController = createAttemptController(options.signal, config.timeoutMs);
  let response = null;
  let error = null;

  try {
    response = await fetcher(url, { ...options, signal: attemptController.signal });
    if (response.ok || !isRetryableStatus(response.status, config)) {
      return { response, error };
    }
    error = createHttpStatusError(response);
  } catch (caughtError) {
    error = normalizeAttemptError(caughtError, {
      timedOut: attemptController.isTimedOut(),
      timeoutMs: config.timeoutMs,
      context: config.context,
    });
    if (options.signal?.aborted && !attemptController.isTimedOut()) {
      throw error;
    }
  } finally {
    attemptController.cleanup();
  }

  return { response, error };
}

function shouldRetryAttempt({ attempt, maxAttempts, response, error, config }) {
  if (attempt >= maxAttempts - 1) {
    return false;
  }
  if (response && isRetryableStatus(response.status, config)) {
    return true;
  }
  return shouldRetryError(error, config);
}

function calculateDelayForAttempt(attempt, response, config) {
  const retryAfterMs = response ? parseRetryAfterMs(response) : undefined;
  if (typeof retryAfterMs === 'number') {
    return retryAfterMs;
  }
  return calculateRetryDelay(attempt, config);
}

function notifyRetry(config, { attempt, delayMs, status, error }) {
  if (typeof config.onRetry !== 'function') {
    return;
  }
  config.onRetry({
    attempt: attempt + 1,
    maxRetries: config.maxRetries,
    delayMs,
    status,
    error,
  });
}

function finalizeFailure(response, error, fallbackMessage = REQUEST_FAILED_MESSAGE) {
  if (response) {
    return response;
  }
  throw error || new Error(fallbackMessage);
}

async function fetchWithRetry(url, options = {}, configOverrides = {}) {
  const config = normalizeConfig(configOverrides);
  const fetcher = resolveFetcher(config);
  const maxAttempts = Math.max(0, config.maxRetries) + 1;
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new AbortError(REQUEST_ABORTED_MESSAGE);
    }

    const attemptResult = await performAttempt({
      url,
      options,
      config,
      fetcher,
    });
    lastResponse = attemptResult.response;
    lastError = attemptResult.error;

    if (lastResponse?.ok || (lastResponse && !isRetryableStatus(lastResponse.status, config))) {
      return lastResponse;
    }

    const shouldRetry = shouldRetryAttempt({
      attempt,
      maxAttempts,
      response: lastResponse,
      error: lastError,
      config,
    });
    if (!shouldRetry) {
      return finalizeFailure(lastResponse, lastError);
    }

    const delayMs = calculateDelayForAttempt(attempt, lastResponse, config);
    notifyRetry(config, {
      attempt,
      delayMs,
      status: lastResponse?.status,
      error: lastError,
    });
    await sleep(delayMs);
  }

  return finalizeFailure(lastResponse, lastError, REQUEST_FAILED_AFTER_RETRIES_MESSAGE);
}

module.exports = {
  DEFAULT_RETRY_CONFIG,
  fetchWithRetry,
  parseRetryAfterMs,
};
