import { afterEach, describe, expect, it, vi } from 'vitest';
import '../networkRetry.js';

const { fetchWithRetry } = globalThis.LockInNetworkRetry;
const originalFetch = globalThis.fetch;

function createResponse(status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: {
      get: () => null,
    },
  };
}

describe('LockInNetworkRetry.fetchWithRetry', () => {
  afterEach(() => {
    if (globalThis.fetch && globalThis.fetch.mockRestore) {
      globalThis.fetch.mockRestore();
    }
    globalThis.fetch = originalFetch;
  });

  it('retries retryable responses and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse(500))
      .mockResolvedValueOnce(createResponse(200));
    globalThis.fetch = fetchMock;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      {
        maxRetries: 1,
        baseDelayMs: 0,
        maxDelayMs: 0,
      },
    );

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse(404));
    globalThis.fetch = fetchMock;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      {
        maxRetries: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
      },
    );

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws timeout error when request exceeds timeout', async () => {
    const fetchMock = vi.fn((_url, options) => {
      return new Promise((_, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    });
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithRetry('https://example.com', {}, { maxRetries: 0, timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
