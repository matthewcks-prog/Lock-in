import type { AsyncFetcher } from '../fetchers/types';
import { hasRedirectSupport } from '../fetchers/types';
import { calculateBackoffDelay } from '../../network/retry';
import { log } from './echo360Logger';

export const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const HTTP_STATUS_CLIENT_ERROR_START = 400;
const HTTP_STATUS_SERVER_ERROR_START = 500;

/**
 * Create a timeout error with a standardized code.
 */
function createTimeoutError(message: string): Error {
  const error = new Error(message);
  (error as { code?: string }).code = 'TIMEOUT';
  return error;
}

/**
 * Check if an error represents a timeout.
 */
export function isTimeoutError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const code = (error as { code?: string }).code;
  if (code === 'TIMEOUT') return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('timeout') || message.includes('AbortError');
}

/**
 * Extract HTTP status from a thrown error or message.
 */
function extractErrorStatus(error: unknown): number | null {
  if (error === null || error === undefined) return null;
  const status = (error as { status?: number }).status;
  if (typeof status === 'number') return status;
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  return match !== null ? Number(match[1]) : null;
}

/**
 * Decide whether an error should be retried.
 */
function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'AUTH_REQUIRED') return false;

  const status = extractErrorStatus(error);
  if (typeof status === 'number') {
    if (status >= HTTP_STATUS_CLIENT_ERROR_START && status < HTTP_STATUS_SERVER_ERROR_START) {
      return false;
    }
  }

  const code = (error as { code?: string }).code;
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
    return true;
  }

  if (isTimeoutError(error)) return true;

  return (
    message.includes('NetworkError') ||
    message.includes('Failed to fetch') ||
    message.includes('Network request failed')
  );
}

/**
 * Delay helper for retry backoff.
 */
async function sleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Wrap a promise with a timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(createTimeoutError(errorMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function buildRequest<T>(
  fetcher: AsyncFetcher,
  responseType: 'json' | 'text',
  url: string,
): Promise<T> {
  if (responseType === 'json') {
    return fetcher.fetchJson<T>(url);
  }
  return fetcher.fetchWithCredentials(url) as unknown as Promise<T>;
}

type RetryLogContext = {
  requestId: string;
  context: string;
  url: string;
  maxRetries: number;
  errorMessage: string;
};

function logRetryLimitReached(params: RetryLogContext): void {
  log('warn', params.requestId, 'Retry limit reached', {
    url: params.url,
    context: params.context,
    maxRetries: params.maxRetries,
    error: params.errorMessage,
  });
}

function logRetryAttempt(params: RetryLogContext & { attempt: number; delayMs: number }): void {
  log('info', params.requestId, 'Retrying request', {
    url: params.url,
    context: params.context,
    attempt: params.attempt,
    maxRetries: params.maxRetries,
    delayMs: params.delayMs,
    error: params.errorMessage,
  });
}

function shouldRetry(attempt: number, maxRetries: number, error: unknown): boolean {
  if (!isRetryableError(error)) return false;
  return attempt < maxRetries;
}

type RetryOptions = {
  requestId: string;
  responseType: 'json' | 'text';
  context: string;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
};

function normalizeRetryOptions(options: {
  requestId: string;
  responseType: 'json' | 'text';
  context: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}): RetryOptions {
  return {
    requestId: options.requestId,
    responseType: options.responseType,
    context: options.context,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

async function handleRetry<T>(params: {
  error: unknown;
  attempt: number;
  fetcher: AsyncFetcher;
  url: string;
  options: RetryOptions;
}): Promise<T> {
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  if (isTimeoutError(params.error)) {
    log('warn', params.options.requestId, 'Request timed out', {
      url: params.url,
      context: params.options.context,
      timeoutMs: params.options.timeoutMs,
    });
  }

  if (!shouldRetry(params.attempt, params.options.maxRetries, params.error)) {
    if (params.attempt >= params.options.maxRetries) {
      logRetryLimitReached({
        requestId: params.options.requestId,
        context: params.options.context,
        url: params.url,
        maxRetries: params.options.maxRetries,
        errorMessage: message,
      });
    }
    throw params.error;
  }

  const delayMs = calculateBackoffDelay(
    params.options.retryDelayMs,
    Number.POSITIVE_INFINITY,
    params.attempt,
    0,
  );
  logRetryAttempt({
    requestId: params.options.requestId,
    context: params.options.context,
    url: params.url,
    maxRetries: params.options.maxRetries,
    errorMessage: message,
    attempt: params.attempt + 1,
    delayMs,
  });
  await sleep(delayMs);
  return attemptFetch({
    fetcher: params.fetcher,
    url: params.url,
    options: params.options,
    attempt: params.attempt + 1,
  });
}

async function attemptFetch<T>(params: {
  fetcher: AsyncFetcher;
  url: string;
  options: RetryOptions;
  attempt: number;
}): Promise<T> {
  try {
    const request = buildRequest<T>(params.fetcher, params.options.responseType, params.url);
    return await withTimeout(
      request,
      params.options.timeoutMs,
      `${params.options.context} request timed out after ${params.options.timeoutMs}ms`,
    );
  } catch (error) {
    return handleRetry({
      error,
      attempt: params.attempt,
      fetcher: params.fetcher,
      url: params.url,
      options: params.options,
    });
  }
}

/**
 * Fetch with retry and exponential backoff for transient failures.
 */
export async function fetchWithRetry<T>(
  fetcher: AsyncFetcher,
  url: string,
  options: {
    requestId: string;
    responseType: 'json' | 'text';
    context: string;
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  },
): Promise<T> {
  const normalizedOptions = normalizeRetryOptions(options);
  return attemptFetch({ fetcher, url, options: normalizedOptions, attempt: 0 });
}

export async function fetchHtmlWithRedirect(
  url: string,
  fetcher: AsyncFetcher,
): Promise<{ html: string; finalUrl: string }> {
  if (hasRedirectSupport(fetcher)) {
    const result = await fetcher.fetchHtmlWithRedirectInfo(url);
    return { html: result.html, finalUrl: result.finalUrl.length > 0 ? result.finalUrl : url };
  }
  const html = await fetcher.fetchWithCredentials(url);
  return { html, finalUrl: url };
}
