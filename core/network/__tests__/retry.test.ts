import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../retry';

const originalFetch = globalThis.fetch;
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_REDIRECT = 300;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_SERVER_ERROR = 500;
const NO_DELAY_MS = 0;
const SHORT_TIMEOUT_MS = 5;
const RETRY_ONCE = 1;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_SUCCESS_CALL_COUNT = 2;

function createResponse(status: number): Response {
  const isSuccessStatus = status >= HTTP_STATUS_OK && status < HTTP_STATUS_REDIRECT;
  return {
    ok: isSuccessStatus,
    status,
    statusText: isSuccessStatus ? 'OK' : 'Error',
    headers: {
      get: () => null,
    },
  } as unknown as Response;
}

type MockedFetch = typeof fetch & { mockRestore?: () => void };

function setGlobalFetch(fetchMock: ReturnType<typeof vi.fn>): void {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

function restoreGlobalFetch(): void {
  const currentFetch = globalThis.fetch as MockedFetch | undefined;
  if (typeof currentFetch?.mockRestore === 'function') {
    currentFetch.mockRestore();
  }
  globalThis.fetch = originalFetch;
}

function createAbortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

async function createAbortablePendingResponse(options?: RequestInit): Promise<Response> {
  return await new Promise((_resolve, reject) => {
    const signal = options?.signal;
    if (signal !== undefined && signal !== null) {
      signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
    }
  });
}

async function retriesRetryableResponsesAndSucceeds(): Promise<void> {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(createResponse(HTTP_STATUS_SERVER_ERROR))
    .mockResolvedValueOnce(createResponse(HTTP_STATUS_OK));
  setGlobalFetch(fetchMock);

  const response = await fetchWithRetry(
    'https://example.com',
    {},
    {
      maxRetries: RETRY_ONCE,
      baseDelayMs: NO_DELAY_MS,
      maxDelayMs: NO_DELAY_MS,
    },
  );

  expect(response.ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(RETRY_SUCCESS_CALL_COUNT);
}

async function doesNotRetryNonRetryableResponses(): Promise<void> {
  const fetchMock = vi.fn().mockResolvedValue(createResponse(HTTP_STATUS_NOT_FOUND));
  setGlobalFetch(fetchMock);

  const response = await fetchWithRetry(
    'https://example.com',
    {},
    {
      maxRetries: DEFAULT_MAX_RETRIES,
      baseDelayMs: NO_DELAY_MS,
      maxDelayMs: NO_DELAY_MS,
    },
  );

  expect(response.status).toBe(HTTP_STATUS_NOT_FOUND);
  expect(fetchMock).toHaveBeenCalledTimes(1);
}

async function throwsTimeoutErrorWhenRequestExceedsTimeout(): Promise<void> {
  const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
    return createAbortablePendingResponse(options);
  });
  setGlobalFetch(fetchMock);

  await expect(
    fetchWithRetry(
      'https://example.com',
      {},
      { maxRetries: NO_DELAY_MS, timeoutMs: SHORT_TIMEOUT_MS },
    ),
  ).rejects.toMatchObject({
    code: 'TIMEOUT',
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
}

describe('fetchWithRetry', () => {
  afterEach(restoreGlobalFetch);
  it('retries retryable responses and succeeds', retriesRetryableResponsesAndSucceeds);
  it('does not retry non-retryable responses', doesNotRetryNonRetryableResponses);
  it(
    'throws timeout error when request exceeds timeout',
    throwsTimeoutErrorWhenRequestExceedsTimeout,
  );
});
