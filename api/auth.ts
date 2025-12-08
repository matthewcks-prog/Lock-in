/**
 * Supabase Auth Client
 * 
 * Chrome-agnostic authentication client for Supabase.
 * Uses storage interface abstraction - no Chrome dependencies.
 */

import type { StorageInterface } from "../core/storage/storageInterface";
import type { AuthSession, AuthUser } from "../core/domain/types";

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sessionStorageKey?: string;
  tokenExpiryBufferMs?: number;
}

export interface AuthClient {
  signUpWithEmail(email: string, password: string): Promise<AuthSession>;
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthUser | null>;
  getValidAccessToken(): Promise<string | null>;
  onSessionChanged(callback: (session: AuthSession | null) => void): () => void;
}

/**
 * Create auth error with code
 */
function createAuthError(message: string, code: string = "AUTH_ERROR", details?: any): Error {
  const error = new Error(message || "Authentication failed");
  (error as any).code = code;
  if (details) {
    (error as any).details = details;
  }
  return error;
}

/**
 * Parse error response from Supabase
 */
async function parseErrorResponse(response: Response, fallbackMessage: string): Promise<{ message: string; code: string; details?: any }> {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch (_) {
    try {
      const text = await response.text();
      if (text) {
        payload = { message: text };
      }
    } catch (_) {
      // ignore
    }
  }

  const message =
    payload?.error_description ||
    payload?.error ||
    payload?.message ||
    fallbackMessage;
  const normalized = (message || "").toLowerCase();

  let code = "AUTH_ERROR";
  if (normalized.includes("already registered")) {
    code = "USER_ALREADY_REGISTERED";
  } else if (normalized.includes("invalid login")) {
    code = "INVALID_LOGIN";
  } else if (normalized.includes("email not confirmed")) {
    code = "EMAIL_NOT_CONFIRMED";
  } else if (normalized.includes("invalid email")) {
    code = "INVALID_EMAIL";
  }

  return { message, code, details: payload };
}

/**
 * Normalize Supabase session data
 */
function normalizeSession(data: any, fallbackUser: AuthUser | null = null): AuthSession {
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("Supabase session payload missing tokens");
  }

  const expiresIn = Number(data.expires_in) || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tokenType: data.token_type || "bearer",
    user: data.user || fallbackUser || null,
  };
}

/**
 * Create Supabase auth client
 */
export function createAuthClient(config: AuthConfig, storage: StorageInterface): AuthClient {
  const {
    supabaseUrl,
    supabaseAnonKey,
    sessionStorageKey = "lockinSupabaseSession",
    tokenExpiryBufferMs = 60000,
  } = config;

  const listeners = new Set<(session: AuthSession | null) => void>();

  function assertConfig(): void {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase URL or anon key is not configured");
    }
  }

  async function readStorage(): Promise<AuthSession | null> {
    try {
      const data = await storage.get(sessionStorageKey);
      return data[sessionStorageKey] || null;
    } catch (error) {
      console.error("Lock-in auth storage read error:", error);
      return null;
    }
  }

  async function writeStorage(session: AuthSession): Promise<void> {
    try {
      await storage.set({ [sessionStorageKey]: session });
    } catch (error) {
      console.error("Lock-in auth storage write error:", error);
    }
  }

  async function clearStorage(): Promise<void> {
    try {
      await storage.remove(sessionStorageKey);
    } catch (error) {
      console.error("Lock-in auth storage clear error:", error);
    }
  }

  function notify(session: AuthSession | null): void {
    listeners.forEach((cb) => {
      try {
        cb(session);
      } catch (error) {
        console.error("Lock-in auth listener error:", error);
      }
    });
  }

  async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
    assertConfig();

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(response, "Failed to sign in");
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = await response.json();
    const session = normalizeSession(data);
    await writeStorage(session);
    notify(session);
    return session;
  }

  async function signUpWithEmail(email: string, password: string): Promise<AuthSession> {
    assertConfig();

    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(response, "Failed to create account");
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = await response.json();

    if (!data?.access_token || !data?.refresh_token) {
      throw createAuthError(
        "Check your email to confirm your account, then sign in.",
        "EMAIL_CONFIRMATION_REQUIRED",
        data
      );
    }

    const session = normalizeSession(data);
    await writeStorage(session);
    notify(session);
    return session;
  }

  async function refreshSession(refreshToken: string, existingUser: AuthUser | null = null): Promise<AuthSession> {
    assertConfig();

    if (!refreshToken) {
      throw new Error("Missing refresh token");
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearStorage();
      let errorMessage = "Failed to refresh session";
      try {
        const errorBody = await response.json();
        errorMessage = errorBody?.error_description || errorBody?.message || errorMessage;
      } catch (_) {
        // ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const session = normalizeSession(
      { ...data, refresh_token: data.refresh_token || refreshToken },
      existingUser
    );
    await writeStorage(session);
    notify(session);
    return session;
  }

  async function getSession(): Promise<AuthSession | null> {
    return readStorage();
  }

  async function getValidAccessToken(): Promise<string | null> {
    const session = await readStorage();
    if (!session) {
      return null;
    }

    const expiresAt = Number(session.expiresAt) || 0;
    const buffer = tokenExpiryBufferMs;
    if (expiresAt - buffer > Date.now()) {
      return session.accessToken;
    }

    try {
      const refreshed = await refreshSession(session.refreshToken, session.user);
      return refreshed.accessToken;
    } catch (error) {
      console.error("Lock-in token refresh failed:", (error as Error).message);
      return null;
    }
  }

  async function getCurrentUser(): Promise<AuthUser | null> {
    const session = await getSession();
    return session?.user || null;
  }

  async function signOut(): Promise<void> {
    await clearStorage();
    notify(null);
  }

  function onSessionChanged(callback: (session: AuthSession | null) => void): () => void {
    if (typeof callback !== "function") {
      return () => {};
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  // Listen to storage changes
  storage.onChanged((changes, areaName) => {
    if (areaName === "sync" && changes[sessionStorageKey]) {
      notify(changes[sessionStorageKey].newValue || null);
    }
  });

  return {
    signUpWithEmail,
    signInWithEmail,
    signOut,
    getSession,
    getCurrentUser,
    getValidAccessToken,
    onSessionChanged,
  };
}
