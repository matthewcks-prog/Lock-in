import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { API_CLIENT_EXPECTED_KEYS } from './expectedApiClientKeys';
import { type ApiClient, type ApiClientConfig, createApiClient } from '../client';
import { backendUrl, createAuthStub, resetEnv } from './testUtils';

const STATUS_OK = 200;

describe('createApiClient public surface', () => {
  beforeEach(resetEnv);

  it('returns the exact method bag', () => {
    const client = createApiClient({
      backendUrl,
      authClient: createAuthStub(),
      fetcher: vi.fn() as unknown as typeof fetch,
    });

    expect(Object.keys(client).sort()).toEqual([...API_CLIENT_EXPECTED_KEYS]);
  });

  it('keeps the createApiClient signature stable', () => {
    expectTypeOf(createApiClient).parameters.toEqualTypeOf<[ApiClientConfig]>();
    expectTypeOf(createApiClient).returns.toEqualTypeOf<ApiClient>();
    expectTypeOf<ApiClient>().toEqualTypeOf<ReturnType<typeof createApiClient>>();
  });
});

describe('note asset mapping', () => {
  it('maps snake_case asset fields to camelCase NoteAsset', async () => {
    const authClient = createAuthStub();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'a1',
          note_id: 'n1',
          user_id: 'u1',
          type: 'image',
          mime_type: 'image/png',
          storage_path: 'path',
          created_at: '2024-01-01',
          url: 'http://x/img',
          file_name: 'img.png',
        }),
        { status: STATUS_OK, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = createApiClient({
      backendUrl,
      authClient,
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const asset = await client.uploadNoteAsset({ noteId: 'n1', file: new Blob() });

    expect(asset).toEqual({
      id: 'a1',
      noteId: 'n1',
      userId: 'u1',
      type: 'image',
      mimeType: 'image/png',
      storagePath: 'path',
      createdAt: '2024-01-01',
      url: 'http://x/img',
      fileName: 'img.png',
    });
  });
});
