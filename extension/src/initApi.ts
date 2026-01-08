/**
 * Initialize API and Auth Clients for Extension
 *
 * This file wires together the Chrome-specific storage with the Chrome-agnostic
 * API and auth clients. It is the bridge between extension code and shared code.
 *
 * This is bundled by vite.config.initApi.ts into extension/dist/libs/initApi.js (IIFE format)
 * and exposes window.LockInAuth and window.LockInAPI for use by content scripts.
 */

import { createAuthClient, type AuthClient } from '../../api/auth';
import { createApiClient, type ApiClient } from '../../api/client';
import { chromeStorage } from './chromeStorage';

/**
 * Extension configuration from window.LOCKIN_CONFIG (set by config.js)
 */
export interface LockInConfig {
  backendUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  sessionStorageKey: string;
  tokenExpiryBufferMs: number;
}

/**
 * Get config from window (set by config.js)
 */
export function getConfig(): LockInConfig {
  const config = (typeof window !== 'undefined' && (window as any).LOCKIN_CONFIG) || {};
  return {
    backendUrl: config.BACKEND_URL || 'http://localhost:3000',
    supabaseUrl: config.SUPABASE_URL || '',
    supabaseAnonKey: config.SUPABASE_ANON_KEY || '',
    sessionStorageKey: config.SESSION_STORAGE_KEY || 'lockinSupabaseSession',
    tokenExpiryBufferMs: Number(config.TOKEN_EXPIRY_BUFFER_MS) || 60000,
  };
}

/**
 * Initialize auth client with Chrome storage
 */
export function initAuthClient(): AuthClient {
  const config = getConfig();
  return createAuthClient(
    {
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      sessionStorageKey: config.sessionStorageKey,
      tokenExpiryBufferMs: config.tokenExpiryBufferMs,
    },
    chromeStorage,
  );
}

/**
 * Initialize API client with auth client
 */
export function initApiClient(authClient: AuthClient): ApiClient {
  const config = getConfig();
  return createApiClient({
    backendUrl: config.backendUrl,
    authClient,
  });
}

/**
 * Cached clients for singleton pattern
 */
let cachedClients: { authClient: AuthClient; apiClient: ApiClient } | null = null;

/**
 * Initialize both clients and expose globally for backward compatibility
 */
export function initClients(): { authClient: AuthClient; apiClient: ApiClient } {
  if (cachedClients) {
    return cachedClients;
  }

  const authClient = initAuthClient();
  const apiClient = initApiClient(authClient);

  cachedClients = { authClient, apiClient };

  // Expose globally for legacy code and content scripts
  if (typeof window !== 'undefined') {
    (window as any).LockInAuth = authClient;
    (window as any).LockInAPI = apiClient;

    // Also expose as authClient/apiClient for backward compatibility
    (window as any).authClient = authClient;
    (window as any).apiClient = apiClient;
  }

  return cachedClients;
}

/**
 * Get cached clients (or initialize if not cached)
 */
export function getClients(): { authClient: AuthClient; apiClient: ApiClient } {
  return cachedClients || initClients();
}

// Auto-initialize when loaded in browser context
if (typeof window !== 'undefined') {
  initClients();
}

// Re-export types for convenience
export type { AuthClient } from '../../api/auth';
export type { ApiClient } from '../../api/client';
