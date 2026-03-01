import { RETRY_JITTER_RATIO } from './constants';
import type { RetryConfig } from './types';

export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * (Math.random() * RETRY_JITTER_RATIO);
  return Math.floor(cappedDelay + jitter);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseRetryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (value === null || value.length === 0) {
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

export function shouldRetryResponse(
  response: Response,
  retryConfig: RetryConfig,
  retryEnabled: boolean,
  attempt: number,
): boolean {
  return (
    retryEnabled &&
    retryConfig.retryableStatuses.includes(response.status) &&
    attempt < retryConfig.maxRetries
  );
}
