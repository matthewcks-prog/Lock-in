import { TimeoutError } from '../errors';
import type { RetryConfig } from './retry';

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNetworkError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
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

export function createTimeoutError(timeoutMs: number, context?: string): TimeoutError {
  const operation = isNonEmptyString(context) ? context : 'network request';
  return new TimeoutError(operation, timeoutMs);
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      (error as Error & { code?: string }).code === 'ABORTED' ||
      (error as Error & { code?: string }).code === 'ABORT_ERR' ||
      (error as Error & { code?: string }).code === 'ERR_ABORTED')
  );
}

export function shouldRetryError(error: unknown, config: RetryConfig): boolean {
  if (error === null || error === undefined) return false;
  const code = (error as { code?: string }).code;
  if (code === 'TIMEOUT') return config.retryOnTimeout;
  if (code === 'ABORTED') return false;
  if (isNetworkError(error)) return config.retryOnNetworkError;
  return false;
}

export function createAbortError(): Error {
  const abortError = new Error('Request aborted');
  abortError.name = 'AbortError';
  return abortError;
}
