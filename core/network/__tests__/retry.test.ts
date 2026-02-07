import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../retry';

const originalFetch = globalThis.fetch;

function createResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: {
      get: () => null,
    },
  } as unknown as Response;
}

describe('fetchWithRetry', () => {
  afterEach(() => {
    if (globalThis.fetch && 'mockRestore' in globalThis.fetch) {
      (globalThis.fetch as unknown as { mockRestore: () => void }).mockRestore();
    }
    globalThis.fetch = originalFetch;
  });

  it('retries retryable responses and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse(500))
      .mockResolvedValueOnce(createResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    );

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(404));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 },
    );

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws timeout error when request exceeds timeout', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchWithRetry('https://example.com', {}, { maxRetries: 0, timeoutMs: 5 }),
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
