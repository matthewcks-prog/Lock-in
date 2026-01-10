import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_EXPECTED_KEYS } from '@api/__tests__/expectedApiClientKeys';
import type { AuthClient } from '@api/auth';
import type { ApiClient } from '@api/client';

const AUTH_CLIENT_EXPECTED_KEYS = [
  'signUpWithEmail',
  'signInWithEmail',
  'signOut',
  'getSession',
  'getCurrentUser',
  'getValidAccessToken',
  'getAccessToken',
  'onSessionChanged',
] as const;

type InitApiTestWindow = typeof window & {
  LOCKIN_CONFIG?: {
    BACKEND_URL: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SESSION_STORAGE_KEY: string;
    TOKEN_EXPIRY_BUFFER_MS: number;
  };
  LockInAPI?: ApiClient;
  LockInAuth?: AuthClient;
  apiClient?: ApiClient;
  authClient?: AuthClient;
};

describe('initApi global surface', () => {
  let testWindow: InitApiTestWindow;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    testWindow = window as InitApiTestWindow;

    const storageSync = {
      get: vi.fn((_key, cb: (value: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_data, cb: () => void) => cb()),
      remove: vi.fn((_keys, cb: () => void) => cb()),
    };

    const storageLocal = {
      get: vi.fn((_key, cb: (value: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_data, cb: () => void) => cb()),
      remove: vi.fn((_keys, cb: () => void) => cb()),
    };

    const onChanged = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    vi.stubGlobal('chrome', {
      storage: {
        sync: storageSync,
        local: storageLocal,
        onChanged,
      },
      runtime: {
        lastError: null,
      },
    });

    testWindow.LOCKIN_CONFIG = {
      BACKEND_URL: 'http://example.test',
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_ANON_KEY: 'anon-key',
      SESSION_STORAGE_KEY: 'lockinSupabaseSession',
      TOKEN_EXPIRY_BUFFER_MS: 60000,
    };

    delete testWindow.LockInAPI;
    delete testWindow.LockInAuth;
    delete testWindow.apiClient;
    delete testWindow.authClient;
  });

  it('initializes and exposes stable LockInAPI/LockInAuth globals with compat aliases', async () => {
    const { initClients } = await import('../initApi');
    const lockInApi = testWindow.LockInAPI as ApiClient;
    const lockInAuth = testWindow.LockInAuth as AuthClient;

    expect(lockInApi).toBeDefined();
    expect(lockInAuth).toBeDefined();

    expect(Object.keys(lockInApi).sort()).toEqual([...API_CLIENT_EXPECTED_KEYS]);
    expect(Object.keys(lockInAuth).sort()).toEqual([...AUTH_CLIENT_EXPECTED_KEYS].sort());

    API_CLIENT_EXPECTED_KEYS.forEach((key) => {
      expect(typeof lockInApi[key as keyof ApiClient]).toBe('function');
    });
    AUTH_CLIENT_EXPECTED_KEYS.forEach((key) => {
      expect(typeof lockInAuth[key as keyof AuthClient]).toBe('function');
    });

    expect(testWindow.apiClient).toBe(lockInApi);
    expect(testWindow.authClient).toBe(lockInAuth);

    const { apiClient, authClient } = initClients();
    expect(apiClient).toBe(lockInApi);
    expect(authClient).toBe(lockInAuth);
  });
});
