import type { AsyncFetcher } from '../fetchers/types';
import { hasRedirectSupport } from '../fetchers/types';
import { log } from './echo360Logger';

export const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

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
  if (!error) return false;
  const code = (error as { code?: string }).code;
  if (code === 'TIMEOUT') return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('timeout') || message.includes('AbortError');
}

/**
 * Extract HTTP status from a thrown error or message.
 */
function extractErrorStatus(error: unknown): number | null {
  if (!error) return null;
  const status = (error as { status?: number }).status;
  if (typeof status === 'number') return status;
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

/**
 * Decide whether an error should be retried.
 */
function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'AUTH_REQUIRED') return false;

  const status = extractErrorStatus(error);
  if (typeof status === 'number') {
    if (status >= 400 && status < 500) return false;
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
function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
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
    if (timeoutId) clearTimeout(timeoutId);
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
  const {
    requestId,
    responseType,
    context,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      const request =
        responseType === 'json'
          ? fetcher.fetchJson<T>(url)
          : (fetcher.fetchWithCredentials(url) as unknown as Promise<T>);
      return await withTimeout(
        request,
        timeoutMs,
        `${context} request timed out after ${timeoutMs}ms`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isTimeoutError(error)) {
        log('warn', requestId, 'Request timed out', { url, context, timeoutMs });
      }

      if (!isRetryableError(error) || attempt >= maxRetries) {
        if (attempt >= maxRetries) {
          log('warn', requestId, 'Retry limit reached', {
            url,
            context,
            maxRetries,
            error: message,
          });
        }
        throw error;
      }

      const delayMs = retryDelayMs * Math.pow(2, attempt);
      log('info', requestId, 'Retrying request', {
        url,
        context,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: message,
      });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

export async function fetchHtmlWithRedirect(
  url: string,
  fetcher: AsyncFetcher,
): Promise<{ html: string; finalUrl: string }> {
  if (hasRedirectSupport(fetcher) && fetcher.fetchHtmlWithRedirectInfo) {
    const result = await fetcher.fetchHtmlWithRedirectInfo(url);
    return { html: result.html, finalUrl: result.finalUrl || url };
  }
  const html = await fetcher.fetchWithCredentials(url);
  return { html, finalUrl: url };
}
