const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { fetchWithRetry } = require('../networkRetry');
const originalFetch = global.fetch;

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

describe('networkRetry.fetchWithRetry', () => {
  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it('retries retryable responses and succeeds', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return calls === 1 ? createResponse(500) : createResponse(200);
    };

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      {
        maxRetries: 1,
        baseDelayMs: 0,
        maxDelayMs: 0,
      },
    );

    assert.strictEqual(response.ok, true);
    assert.strictEqual(calls, 2);
  });

  it('does not retry non-retryable responses', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return createResponse(404);
    };

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      {
        maxRetries: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
      },
    );

    assert.strictEqual(response.status, 404);
    assert.strictEqual(calls, 1);
  });

  it('throws timeout error when request exceeds timeout', async () => {
    global.fetch = (_url, options) =>
      new Promise((_, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });

    await assert.rejects(
      () => fetchWithRetry('https://example.com', {}, { maxRetries: 0, timeoutMs: 5 }),
      (error) => error && error.code === 'TIMEOUT',
    );
  });
});
