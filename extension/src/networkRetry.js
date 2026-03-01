/**
 * Network Retry Utilities
 *
 * Provides robust retry logic with exponential backoff, timeout handling,
 * and configurable retry conditions for network requests.
 */

// eslint-disable-next-line max-statements -- IIFE wrapper required for Chrome extension scope isolation
(function () {
  // Configuration constants
  const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
  const HTTP_STATUS_UNAUTHORIZED = 401;
  const HTTP_STATUS_FORBIDDEN = 403;
  const HTTP_STATUS_NOT_FOUND = 404;
  const HTTP_STATUS_SERVER_ERROR_MIN = 500;
  const RETRY_JITTER_FACTOR = 0.3;

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

  // Configuration helpers
  function normalizeConfig(overrides) {
    if (!overrides) return { ...DEFAULT_RETRY_CONFIG };
    const retryableStatuses = Array.isArray(overrides.retryableStatuses)
      ? overrides.retryableStatuses
      : DEFAULT_RETRY_CONFIG.retryableStatuses;
    return { ...DEFAULT_RETRY_CONFIG, ...overrides, retryableStatuses };
  }

  // Utility functions
  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function calculateRetryDelay(attempt, config) {
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    const jitter = cappedDelay * (Math.random() * RETRY_JITTER_FACTOR);
    return Math.floor(cappedDelay + jitter);
  }

  function parseRetryAfterMs(response) {
    const value = response.headers?.get?.('retry-after');
    if (!value) return undefined;

    const seconds = Number(value);
    if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);

    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
    return undefined;
  }

  // Status and error checking
  function isRetryableStatus(status, config) {
    if (status === 0) return false;
    if (
      status === HTTP_STATUS_UNAUTHORIZED ||
      status === HTTP_STATUS_FORBIDDEN ||
      status === HTTP_STATUS_NOT_FOUND
    ) {
      return false;
    }
    if (config.retryableStatuses.includes(status)) return true;
    if (config.retryOnServerError && status >= HTTP_STATUS_SERVER_ERROR_MIN) return true;
    return false;
  }

  function isNetworkError(error) {
    if (!error) return false;
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
    if (error.code === 'ABORTED') return false;
    if (isNetworkError(error)) return config.retryOnNetworkError;
    return false;
  }

  // Timeout handling
  async function withTimeout(promise, timeoutMs, context) {
    if (!timeoutMs || timeoutMs <= 0) return promise;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(createTimeoutError(timeoutMs, context));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // Abort handling
  function createAbortError() {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    return abortError;
  }

  function toError(error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  function bindAbortSignal(signal, controller, abortFromSignal) {
    if (!signal) return () => {};
    if (signal.aborted) {
      controller.abort();
      return () => {};
    }
    signal.addEventListener('abort', abortFromSignal, { once: true });
    return () => {
      signal.removeEventListener('abort', abortFromSignal);
    };
  }

  function createAttemptAbortState(options, config) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromSignal = () => {
      controller.abort();
    };
    const unbindAbortSignal = bindAbortSignal(options.signal, controller, abortFromSignal);
    const timeoutId =
      config.timeoutMs && config.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, config.timeoutMs)
        : null;

    return {
      controller,
      isTimedOut: () => timedOut,
      cleanup: () => {
        if (timeoutId) clearTimeout(timeoutId);
        unbindAbortSignal();
      },
    };
  }

  // Attempt execution
  async function executeAttempt({ url, options, config, fetcher }) {
    const abortState = createAttemptAbortState(options, config);
    try {
      const response = await fetcher(url, { ...options, signal: abortState.controller.signal });
      return { response, error: null };
    } catch (error) {
      const timedOut = abortState.isTimedOut();
      const normalizedError =
        isAbortError(error) && timedOut
          ? createTimeoutError(config.timeoutMs, config.context)
          : toError(error);
      return {
        response: null,
        error: normalizedError,
        externalAbort: Boolean(options.signal?.aborted && !timedOut),
      };
    } finally {
      abortState.cleanup();
    }
  }

  // Retry logic
  function resolveAttemptResult({ attemptResult, config, state }) {
    if (attemptResult.response) {
      state.lastResponse = attemptResult.response;
      if (attemptResult.response.ok || !isRetryableStatus(attemptResult.response.status, config)) {
        return { returnResponse: attemptResult.response };
      }
      state.lastError = new Error(
        `HTTP ${attemptResult.response.status}: ${attemptResult.response.statusText}`,
      );
      return {};
    }

    state.lastError = attemptResult.error;
    if (attemptResult.externalAbort) {
      return { throwError: state.lastError };
    }
    return {};
  }

  function shouldRetryAttempt({ state, attempt, maxAttempts, config }) {
    if (attempt >= maxAttempts - 1) return false;
    if (state.lastResponse && isRetryableStatus(state.lastResponse.status, config)) {
      return true;
    }
    return shouldRetryError(state.lastError, config);
  }

  function resolveRetryDelay(lastResponse, attempt, config) {
    const retryAfterMs = lastResponse ? parseRetryAfterMs(lastResponse) : undefined;
    if (typeof retryAfterMs === 'number') return retryAfterMs;
    return calculateRetryDelay(attempt, config);
  }

  function emitRetry(config, { attempt, delayMs, status, error }) {
    if (typeof config.onRetry !== 'function') return;
    config.onRetry({
      attempt: attempt + 1,
      maxRetries: config.maxRetries,
      delayMs,
      status,
      error,
    });
  }

  function resolveTerminalResult(state, afterRetries = false) {
    if (state.lastResponse) return state.lastResponse;
    if (state.lastError) throw state.lastError;
    throw new Error(afterRetries ? 'Request failed after retries' : 'Request failed');
  }

  // Main retry function
  async function fetchWithRetry(url, options = {}, configOverrides = {}) {
    const config = normalizeConfig(configOverrides);
    const fetcher = config.fetcher || globalThis.fetch;
    if (typeof fetcher !== 'function') {
      throw new Error('Fetch implementation is required.');
    }

    const state = { lastError: null, lastResponse: null };
    const maxAttempts = Math.max(0, config.maxRetries) + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (options.signal?.aborted) {
        throw createAbortError();
      }

      const attemptResult = await executeAttempt({ url, options, config, fetcher });
      const resolution = resolveAttemptResult({ attemptResult, config, state });
      if (resolution.returnResponse) return resolution.returnResponse;
      if (resolution.throwError) throw resolution.throwError;

      if (!shouldRetryAttempt({ state, attempt, maxAttempts, config })) {
        return resolveTerminalResult(state);
      }

      const delayMs = resolveRetryDelay(state.lastResponse, attempt, config);
      emitRetry(config, {
        attempt,
        delayMs,
        status: state.lastResponse?.status,
        error: state.lastError,
      });
      await sleep(delayMs);
    }

    return resolveTerminalResult(state, true);
  }

  // Export to window global for content script usage
  if (typeof window !== 'undefined') {
    window.LockInNetworkRetry = {
      DEFAULT_RETRY_CONFIG,
      fetchWithRetry,
      withTimeout,
      parseRetryAfterMs,
    };
  }
})();
