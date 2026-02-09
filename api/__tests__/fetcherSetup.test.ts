import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveFetch } from '../fetcher/setup';

describe('resolveFetch', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('binds the global fetch to avoid illegal invocation', async () => {
    const strictFetch = async function (this: unknown, _input: RequestInfo | URL) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    };

    globalThis.fetch = strictFetch as unknown as typeof fetch;

    const resolved = resolveFetch();

    await expect(resolved('https://example.com')).resolves.toBeInstanceOf(Response);
  });
});
