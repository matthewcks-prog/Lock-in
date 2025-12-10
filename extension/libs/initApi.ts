/**
 * Initialize API and Auth Clients for Extension
 * 
 * This file wires together the Chrome-specific storage with the Chrome-agnostic
 * API and auth clients. It's the bridge between extension code and shared code.
 */

import { createAuthClient } from "../../api/auth";
import { createApiClient } from "../../api/client";
import { chromeStorage } from "./chromeStorage";

/**
 * Get config from window (set by config.js)
 */
export function getConfig() {
  const config = (typeof window !== "undefined" && (window as any).LOCKIN_CONFIG) || {};
  return {
    backendUrl: config.BACKEND_URL || "http://localhost:3000",
    supabaseUrl: config.SUPABASE_URL || "",
    supabaseAnonKey: config.SUPABASE_ANON_KEY || "",
    sessionStorageKey: config.SESSION_STORAGE_KEY || "lockinSupabaseSession",
    tokenExpiryBufferMs: Number(config.TOKEN_EXPIRY_BUFFER_MS) || 60000,
  };
}

/**
 * Initialize auth client
 */
export function initAuthClient() {
  const config = getConfig();
  return createAuthClient(
    {
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      sessionStorageKey: config.sessionStorageKey,
      tokenExpiryBufferMs: config.tokenExpiryBufferMs,
    },
    chromeStorage
  );
}

/**
 * Initialize API client
 */
export function initApiClient(authClient: ReturnType<typeof initAuthClient>) {
  const config = getConfig();
  return createApiClient({
    backendUrl: config.backendUrl,
    authClient,
  });
}

/**
 * Initialize both clients and expose globally for backward compatibility
 */
let cachedClients: { authClient: ReturnType<typeof initAuthClient>; apiClient: ReturnType<typeof initApiClient> } | null =
  null;

export function initClients() {
  if (cachedClients) {
    return cachedClients;
  }

  const authClient = initAuthClient();
  const apiClient = initApiClient(authClient);

  cachedClients = { authClient, apiClient };

  // Expose globally for backward compatibility with existing code
  if (typeof window !== "undefined") {
    (window as any).LockInAuth = authClient;
    (window as any).LockInAPI = apiClient;
  }

  return cachedClients;
}

// Auto-initialize when running in the extension/page context
if (typeof window !== "undefined") {
  initClients();
  (window as any).LockInInit = {
    getConfig,
    initAuthClient,
    initApiClient,
    initClients,
  };
}
