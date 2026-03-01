import type { RetryConfig, RetryEvent } from './retry';

type RetryNotification = {
  config: RetryConfig;
  attempt: number;
  delayMs: number;
  response: Response | null;
  error: unknown;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function notifyRetry({ config, attempt, delayMs, response, error }: RetryNotification): void {
  if (typeof config.onRetry !== 'function') {
    return;
  }

  const retryEvent: RetryEvent = {
    attempt: attempt + 1,
    maxRetries: config.maxRetries,
    delayMs,
  };

  if (response !== null) {
    retryEvent.status = response.status;
  }
  if (error !== null && error !== undefined) {
    retryEvent.error = error;
  }

  config.onRetry(retryEvent);
}

export async function applyRetryDelay(context: RetryNotification): Promise<void> {
  notifyRetry(context);
  await sleep(context.delayMs);
}
