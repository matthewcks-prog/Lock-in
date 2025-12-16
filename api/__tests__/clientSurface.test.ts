import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { API_CLIENT_EXPECTED_KEYS } from "./expectedApiClientKeys";
import { type ApiClient, type ApiClientConfig, ConflictError, createApiClient } from "../client";
import type { AuthClient } from "../auth";

function createAuthStub(token: string | null = "token"): AuthClient {
  return {
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn(),
    getCurrentUser: vi.fn(),
    getValidAccessToken: vi.fn().mockResolvedValue(token),
    getAccessToken: vi.fn().mockResolvedValue(token),
    onSessionChanged: vi.fn().mockReturnValue(() => {}),
  };
}

const backendUrl = "http://example.test";

describe("createApiClient public surface", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("returns the exact method bag", () => {
    const client = createApiClient({
      backendUrl,
      authClient: createAuthStub(),
    });

    expect(Object.keys(client).sort()).toEqual([...API_CLIENT_EXPECTED_KEYS]);
  });

  it("keeps the createApiClient signature stable", () => {
    expectTypeOf(createApiClient).parameters.toEqualTypeOf<[ApiClientConfig]>();
    expectTypeOf(createApiClient).returns.toEqualTypeOf<ApiClient>();
    expectTypeOf<ApiClient>().toEqualTypeOf<ReturnType<typeof createApiClient>>();
  });
});

describe("apiRequest invariants", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("retries retryable responses with exponential backoff defaults", async () => {
    vi.useFakeTimers();
    const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const authClient = createAuthStub();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "retry later" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ backendUrl, authClient });
    const request = client.apiRequest("/retry-me", { method: "GET" });

    await vi.advanceTimersByTimeAsync(500);
    const result = await request;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
    mathRandomSpy.mockRestore();
  });

  it("maps 409 responses to ConflictError and keeps server version", async () => {
    const authClient = createAuthStub();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updated_at: "server-version" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ backendUrl, authClient });
    const request = client.apiRequest("/conflict", { method: "GET" });

    await expect(request).rejects.toBeInstanceOf(ConflictError);
    await expect(request).rejects.toMatchObject({
      name: "ConflictError",
      serverVersion: "server-version",
      status: 409,
      code: "CONFLICT",
    } satisfies Partial<ConflictError>);
  });

  it("returns undefined on 204 responses", async () => {
    const authClient = createAuthStub();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ backendUrl, authClient });
    const result = await client.apiRequest("/no-content", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("maps aborted signals to ABORTED errors before request runs", async () => {
    const authClient = createAuthStub();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const controller = new AbortController();
    controller.abort();

    const client = createApiClient({ backendUrl, authClient });

    await expect(
      client.apiRequest("/abort", { method: "GET", signal: controller.signal }),
    ).rejects.toMatchObject({ code: "ABORTED", message: "Request was aborted" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes If-Unmodified-Since when provided and maps updatedAt to serverVersion on 409", async () => {
    const authClient = createAuthStub();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: "server-ts" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ backendUrl, authClient });
    const request = client.apiRequest("/notes/1", {
      method: "PUT",
      ifUnmodifiedSince: "local-ts",
      body: JSON.stringify({ title: "t" }),
    });

    await expect(request).rejects.toBeInstanceOf(ConflictError);
    await expect(request).rejects.toMatchObject({ serverVersion: "server-ts" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${backendUrl}/notes/1`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "If-Unmodified-Since": "local-ts",
        }),
      }),
    );
  });
});

describe("note asset mapping", () => {
  it("maps snake_case asset fields to camelCase NoteAsset", async () => {
    const authClient = createAuthStub();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "a1",
          note_id: "n1",
          user_id: "u1",
          type: "image",
          mime_type: "image/png",
          storage_path: "path",
          created_at: "2024-01-01",
          url: "http://x/img",
          file_name: "img.png",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createApiClient({ backendUrl, authClient });
    const asset = await client.uploadNoteAsset({ noteId: "n1", file: new Blob() });

    expect(asset).toEqual({
      id: "a1",
      noteId: "n1",
      userId: "u1",
      type: "image",
      mimeType: "image/png",
      storagePath: "path",
      createdAt: "2024-01-01",
      url: "http://x/img",
      fileName: "img.png",
    });
  });
});
