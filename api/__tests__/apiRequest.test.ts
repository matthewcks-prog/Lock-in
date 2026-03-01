import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient, ConflictError } from '../client';
import { DEFAULT_RETRY_CONFIG } from '../fetcher/constants';
import { backendUrl, createAuthStub, getHeaderValue, resetEnv } from './testUtils';

const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_OK = 200;
const STATUS_CONFLICT = 409;
const STATUS_NO_CONTENT = 204;

function createClient(
  fetcher: typeof fetch,
  authClient = createAuthStub(),
): ReturnType<typeof createApiClient> {
  return createApiClient({
    backendUrl,
    authClient,
    fetcher: fetcher as unknown as typeof fetch,
  });
}

describe('apiRequest retries', () => {
  beforeEach(resetEnv);

  it('retries retryable responses with exponential backoff defaults', async () => {
    vi.useFakeTimers();
    const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'retry later' }), {
          status: STATUS_TOO_MANY_REQUESTS,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: STATUS_OK,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const client = createClient(fetchMock);
    const request = client.apiRequest('/retry-me', { method: 'GET' });

    await vi.advanceTimersByTimeAsync(DEFAULT_RETRY_CONFIG.baseDelayMs);
    const result = await request;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
    mathRandomSpy.mockRestore();
  });
});

describe('apiRequest conflict handling (server version)', () => {
  beforeEach(resetEnv);

  it('maps 409 responses to ConflictError and keeps server version', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ updated_at: 'server-version' }), {
        status: STATUS_CONFLICT,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createClient(fetchMock);
    const request = client.apiRequest('/conflict', { method: 'GET' });

    await expect(request).rejects.toBeInstanceOf(ConflictError);
    await expect(request).rejects.toMatchObject({
      name: 'ConflictError',
      serverVersion: 'server-version',
      status: STATUS_CONFLICT,
      code: 'CONFLICT',
    } satisfies Partial<ConflictError>);
  });
});

describe('apiRequest conflict handling (If-Unmodified-Since)', () => {
  beforeEach(resetEnv);

  it('passes If-Unmodified-Since when provided and maps updatedAt to serverVersion on 409', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: 'server-ts' }), {
        status: STATUS_CONFLICT,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createClient(fetchMock);
    const request = client.apiRequest('/notes/1', {
      method: 'PUT',
      ifUnmodifiedSince: 'local-ts',
      body: JSON.stringify({ title: 't' }),
    });

    await expect(request).rejects.toBeInstanceOf(ConflictError);
    await expect(request).rejects.toMatchObject({ serverVersion: 'server-ts' });
    const call = fetchMock.mock.calls[0];
    if (call === undefined) {
      throw new Error('Expected fetch to be called');
    }
    const [url, options] = call;
    expect(url).toBe(`${backendUrl}/notes/1`);
    const headers = options?.headers as HeadersInit | undefined;
    const headerValue = getHeaderValue(headers, 'If-Unmodified-Since');
    expect(headerValue).toBe('local-ts');
  });
});

describe('apiRequest response handling', () => {
  beforeEach(resetEnv);

  it('returns undefined on 204 responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: STATUS_NO_CONTENT }));

    const client = createClient(fetchMock);
    const result = await client.apiRequest('/no-content', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('maps aborted signals to ABORTED errors before request runs', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();

    const client = createClient(fetchMock);

    await expect(
      client.apiRequest('/abort', { method: 'GET', signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED', message: 'Request was aborted' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
