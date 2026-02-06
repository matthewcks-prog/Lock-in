const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  timeoutMs: 30000,
  retryableStatuses: [429],
  retryOnServerError: true,
  retryOnNetworkError: true,
  retryOnTimeout: true,
};

function normalizeConfig(overrides) {
  if (!overrides) return { ...DEFAULT_RETRY_CONFIG };
  const retryableStatuses = Array.isArray(overrides.retryableStatuses)
    ? overrides.retryableStatuses
    : DEFAULT_RETRY_CONFIG.retryableStatuses;
  return { ...DEFAULT_RETRY_CONFIG, ...overrides, retryableStatuses };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateRetryDelay(attempt, config) {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * (Math.random() * 0.3);
  return Math.floor(cappedDelay + jitter);
}

function parseRetryAfterMs(response) {
  const value = response.headers?.get?.('retry-after');
  if (!value) return undefined;

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
  if (status === 0) return false;
  if (status === 401 || status === 403 || status === 404) return false;
  if (config.retryableStatuses.includes(status)) return true;
  if (config.retryOnServerError && status >= 500) return true;
  return false;
}

function isNetworkError(error) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EAI_AGAIN')
  );
}

function createTimeoutError(timeoutMs, context) {
  const label = context ? `${context} ` : '';
  const error = new Error(`${label}timed out after ${timeoutMs}ms`);
  error.code = 'TIMEOUT';
  error.name = 'TimeoutError';
  return error;
}

function isAbortError(error) {
  return error instanceof Error && error.name === 'AbortError';
}

function shouldRetryError(error, config) {
  if (!error) return false;
  if (error.code === 'TIMEOUT') return config.retryOnTimeout;
  if (isNetworkError(error)) return config.retryOnNetworkError;
  return false;
}

async function fetchWithRetry(url, options = {}, configOverrides = {}) {
  const config = normalizeConfig(configOverrides);
  const fetcher = config.fetcher || global.fetch;
  if (typeof fetcher !== 'function') {
    throw new Error('Fetch implementation is required.');
  }

  const maxAttempts = Math.max(0, config.maxRetries) + 1;
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    let timeoutId;
    let timedOut = false;
    const controller = new AbortController();
    const abortFromSignal = () => controller.abort();

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', abortFromSignal, { once: true });
      }
    }

    if (config.timeoutMs && config.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, config.timeoutMs);
    }

    try {
      const response = await fetcher(url, { ...options, signal: controller.signal });
      lastResponse = response;

      if (response.ok || !isRetryableStatus(response.status, config)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (isAbortError(error) && timedOut) {
        lastError = createTimeoutError(config.timeoutMs, config.context);
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      if (options.signal?.aborted && !timedOut) {
        throw lastError;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', abortFromSignal);
      }
    }

    const shouldRetry =
      lastResponse && isRetryableStatus(lastResponse.status, config)
        ? true
        : shouldRetryError(lastError, config);

    if (!shouldRetry || attempt >= maxAttempts - 1) {
      if (lastResponse) {
        return lastResponse;
      }
      throw lastError || new Error('Request failed');
    }

    const retryAfterMs = lastResponse ? parseRetryAfterMs(lastResponse) : undefined;
    const delayMs =
      typeof retryAfterMs === 'number' ? retryAfterMs : calculateRetryDelay(attempt, config);

    if (typeof config.onRetry === 'function') {
      config.onRetry({
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delayMs,
        status: lastResponse?.status,
        error: lastError,
      });
    }

    await sleep(delayMs);
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Request failed after retries');
}

module.exports = {
  DEFAULT_RETRY_CONFIG,
  fetchWithRetry,
  parseRetryAfterMs,
};
