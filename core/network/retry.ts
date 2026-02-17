import {
  createAbortError,
  createTimeoutError,
  isAbortError,
  shouldRetryError,
} from './retryErrorUtils';
import { applyRetryDelay } from './retryNotifications';

// HTTP Status Constants
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
const DEFAULT_JITTER_RATIO = 0.3;

export type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  retryableStatuses: number[];
  retryOnServerError: boolean;
  retryOnNetworkError: boolean;
  retryOnTimeout: boolean;
  fetcher?: typeof fetch;
  onRetry?: (info: RetryEvent) => void;
  context?: string;
};

export type RetryEvent = {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  status?: number;
  error?: unknown;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  timeoutMs: 30000,
  retryableStatuses: [HTTP_TOO_MANY_REQUESTS],
  retryOnServerError: true,
  retryOnNetworkError: true,
  retryOnTimeout: true,
};

function normalizeConfig(overrides?: Partial<RetryConfig>): RetryConfig {
  if (overrides === undefined) return { ...DEFAULT_RETRY_CONFIG };
  const retryableStatuses = Array.isArray(overrides.retryableStatuses)
    ? overrides.retryableStatuses
    : DEFAULT_RETRY_CONFIG.retryableStatuses;
  return { ...DEFAULT_RETRY_CONFIG, ...overrides, retryableStatuses };
}

export function calculateBackoffDelay(
  baseDelayMs: number,
  maxDelayMs: number,
  attempt: number,
  jitterRatio: number = DEFAULT_JITTER_RATIO,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = cappedDelay * Math.random() * jitterRatio;
  return Math.floor(cappedDelay + jitter);
}

export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  return calculateBackoffDelay(config.baseDelayMs, config.maxDelayMs, attempt);
}

export function parseRetryAfterMs(response: {
  headers?: { get?: (name: string) => string | null };
}): number | undefined {
  const value = response.headers?.get?.('retry-after');
  if (value === null || value === undefined || value.length === 0) return undefined;

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

export function isRetryableStatus(status: number, config: RetryConfig): boolean {
  if (status === 0) return false;
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN || status === HTTP_NOT_FOUND) {
    return false;
  }
  if (config.retryableStatuses.includes(status)) return true;
  if (config.retryOnServerError && status >= HTTP_SERVER_ERROR) return true;
  return false;
}

type AbortState = {
  controller: AbortController | null;
  timedOut: { value: boolean };
  cleanup: () => void;
};

type AttemptResult = {
  response: Response | null;
  error: unknown;
  timedOut: boolean;
};

type AttemptHandling = {
  response: Response | null;
  error: unknown;
  shouldReturn: boolean;
};

function resolveFetcher(config: RetryConfig): typeof fetch {
  const fetcher = config.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    throw new Error('Fetch implementation is required.');
  }
  if (fetcher === globalThis.fetch) {
    return globalThis.fetch.bind(globalThis);
  }
  return fetcher;
}

function buildRequestInit(options: RequestInit, controller: AbortController | null): RequestInit {
  const requestInit: RequestInit = { ...options };
  if (controller !== null) {
    requestInit.signal = controller.signal;
  } else if (options.signal !== undefined) {
    requestInit.signal = options.signal;
  }
  return requestInit;
}

function setupAbortController(signal: AbortSignal | undefined, timeoutMs: number): AbortState {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timedOut = { value: false };
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromSignal = (): void => {
    if (controller !== null) {
      controller.abort();
    }
  };

  if (controller !== null && signal !== undefined) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortFromSignal, { once: true });
    }
  }

  if (controller !== null && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut.value = true;
      controller.abort();
    }, timeoutMs);
  }

  const cleanup = (): void => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (controller !== null && signal !== undefined) {
      signal.removeEventListener('abort', abortFromSignal);
    }
  };

  return { controller, timedOut, cleanup };
}

async function executeFetchAttempt(
  url: string,
  options: RequestInit,
  config: RetryConfig,
  fetcher: typeof fetch,
): Promise<AttemptResult> {
  if (options.signal?.aborted === true) {
    return { response: null, error: createAbortError(), timedOut: false };
  }

  const abortState = setupAbortController(options.signal ?? undefined, config.timeoutMs);
  try {
    const response = await fetcher(url, buildRequestInit(options, abortState.controller));
    return { response, error: null, timedOut: abortState.timedOut.value };
  } catch (error) {
    return { response: null, error, timedOut: abortState.timedOut.value };
  } finally {
    abortState.cleanup();
  }
}

function normalizeAttemptError(error: unknown, timedOut: boolean, config: RetryConfig): unknown {
  if (isAbortError(error) && timedOut) {
    return createTimeoutError(config.timeoutMs, config.context);
  }
  if (isAbortError(error)) {
    return createAbortError();
  }
  return error instanceof Error ? error : new Error(String(error));
}

function handleAttemptResult(
  result: AttemptResult,
  config: RetryConfig,
  options: RequestInit,
): AttemptHandling {
  if (result.response !== null) {
    const response = result.response;
    if (response.ok || !isRetryableStatus(response.status, config)) {
      return { response, error: null, shouldReturn: true };
    }
    return {
      response,
      error: new Error(`HTTP ${response.status}: ${response.statusText}`),
      shouldReturn: false,
    };
  }

  const error = normalizeAttemptError(result.error, result.timedOut, config);
  if (options.signal?.aborted === true && result.timedOut === false) {
    throw error;
  }
  return { response: null, error, shouldReturn: false };
}

function shouldRetryAttempt(
  response: Response | null,
  error: unknown,
  config: RetryConfig,
): boolean {
  if (response !== null) {
    return isRetryableStatus(response.status, config);
  }
  return shouldRetryError(error, config);
}

type AttemptDecisionInput = {
  attempt: number;
  maxAttempts: number;
  lastResponse: Response | null;
  lastError: unknown;
  shouldRetry: boolean;
};

function finalizeAttemptDecision({
  attempt,
  maxAttempts,
  lastResponse,
  lastError,
  shouldRetry,
}: AttemptDecisionInput): Response | null {
  if (shouldRetry && attempt < maxAttempts - 1) {
    return null;
  }
  if (lastResponse !== null) {
    return lastResponse;
  }
  throw lastError ?? new Error('Request failed');
}

function getRetryDelay(response: Response | null, attempt: number, config: RetryConfig): number {
  if (response !== null) {
    const retryAfterMs = parseRetryAfterMs(response);
    if (typeof retryAfterMs === 'number') {
      return retryAfterMs;
    }
  }
  return calculateRetryDelay(attempt, config);
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  configOverrides: Partial<RetryConfig> = {},
): Promise<Response> {
  const config = normalizeConfig(configOverrides);
  const fetcher = resolveFetcher(config);

  const maxAttempts = Math.max(0, config.maxRetries) + 1;
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await executeFetchAttempt(url, options, config, fetcher);

    const handled = handleAttemptResult(result, config, options);
    if (handled.shouldReturn && handled.response !== null) {
      return handled.response;
    }
    lastResponse = handled.response;
    lastError = handled.error;

    const shouldRetry = shouldRetryAttempt(lastResponse, lastError, config);
    const terminalResponse = finalizeAttemptDecision({
      attempt,
      maxAttempts,
      lastResponse,
      lastError,
      shouldRetry,
    });
    if (terminalResponse !== null) {
      return terminalResponse;
    }

    const delayMs = getRetryDelay(lastResponse, attempt, config);
    await applyRetryDelay({
      config,
      attempt,
      delayMs,
      response: lastResponse,
      error: lastError,
    });
  }

  if (lastResponse !== null) return lastResponse;
  throw lastError ?? new Error('Request failed after retries');
}
