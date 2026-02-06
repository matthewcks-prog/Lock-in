/**
 * Supabase Auth Client
 *
 * Chrome-agnostic authentication client for Supabase.
 * Uses storage interface abstraction - no Chrome dependencies.
 */

import type { StorageInterface } from '../core/storage/storageInterface';
import type { AuthSession, AuthUser } from '../core/domain/types';
import { createLogger, type Logger } from '../core/utils/logger';
import type { FetchLike } from './fetcher';

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
  getAccessToken(): Promise<string | null>;
  onSessionChanged(callback: (session: AuthSession | null) => void): () => void;
}

type AuthClientError = Error & { code: string; details?: unknown };

type SupabaseSessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: AuthUser | null;
};

export interface AuthDependencies {
  fetcher?: FetchLike;
  logger?: Logger;
}

type RecordValue = Record<string, unknown>;

const AUTH_ERROR_CODE_RULES: Array<{ pattern: string; code: string }> = [
  { pattern: 'already registered', code: 'USER_ALREADY_REGISTERED' },
  { pattern: 'invalid login', code: 'INVALID_LOGIN' },
  { pattern: 'email not confirmed', code: 'EMAIL_NOT_CONFIRMED' },
  { pattern: 'invalid email', code: 'INVALID_EMAIL' },
];

function asRecord(value: unknown): RecordValue | null {
  return typeof value === 'object' && value !== null ? (value as RecordValue) : null;
}

function firstString(candidates: Array<unknown>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) {
      return candidate;
    }
  }
  return undefined;
}

async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (_) {
    try {
      const text = await response.text();
      return text ? { message: text } : null;
    } catch (_) {
      return null;
    }
  }
}

function resolveAuthErrorMessage(
  payloadRecord: RecordValue | null,
  nestedRecord: RecordValue | null,
  fallbackMessage: string,
): string {
  const nestedError = payloadRecord?.['error'];
  const message =
    firstString([
      payloadRecord?.['error_description'],
      nestedRecord?.['message'],
      typeof nestedError === 'string' ? nestedError : undefined,
      payloadRecord?.['message'],
    ]) || fallbackMessage;

  return message || fallbackMessage;
}

function mapAuthErrorCode(message: string): string {
  const normalized = (message || '').toLowerCase();
  for (const rule of AUTH_ERROR_CODE_RULES) {
    if (normalized.includes(rule.pattern)) {
      return rule.code;
    }
  }
  return 'AUTH_ERROR';
}

/**
 * Create auth error with code
 */
function createAuthError(
  message: string,
  code: string = 'AUTH_ERROR',
  details?: unknown,
): AuthClientError {
  const error = new Error(message || 'Authentication failed') as AuthClientError;
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

/**
 * Parse error response from Supabase
 */
async function parseErrorResponse(
  response: Response,
  fallbackMessage: string,
): Promise<{ message: string; code: string; details?: Record<string, unknown> }> {
  const payload = await readErrorPayload(response);
  const payloadRecord = asRecord(payload);
  const nestedRecord = asRecord(payloadRecord?.['error']);
  const message = resolveAuthErrorMessage(payloadRecord, nestedRecord, fallbackMessage);
  const code = mapAuthErrorCode(message);
  const parsed: { message: string; code: string; details?: Record<string, unknown> } = {
    message,
    code,
  };
  if (payloadRecord) {
    parsed.details = payloadRecord;
  }
  return parsed;
}

/**
 * Normalize Supabase session data
 */
function normalizeSession(
  data: SupabaseSessionPayload,
  fallbackUser: AuthUser | null = null,
): AuthSession {
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('Supabase session payload missing tokens');
  }

  const expiresIn = Number(data.expires_in) || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tokenType: data.token_type || 'bearer',
    user: data.user || fallbackUser || null,
  };
}

/**
 * Create Supabase auth client
 */
export function createAuthClient(
  config: AuthConfig,
  storage: StorageInterface,
  deps: AuthDependencies = {},
): AuthClient {
  const {
    supabaseUrl,
    supabaseAnonKey,
    sessionStorageKey = 'lockinSupabaseSession',
    tokenExpiryBufferMs = 60000,
  } = config;

  const fetcher = deps.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    throw new Error('Fetch implementation is required. Provide fetcher in createAuthClient.');
  }

  const logger = deps.logger ?? createLogger('Auth');
  const listeners = new Set<(session: AuthSession | null) => void>();

  function assertConfig(): void {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL or anon key is not configured');
    }
  }

  async function readStorage(): Promise<AuthSession | null> {
    try {
      const data = await storage.get<AuthSession | null>(sessionStorageKey);
      return data[sessionStorageKey] || null;
    } catch (error) {
      logger.error('Auth storage read error', error);
      return null;
    }
  }

  async function writeStorage(session: AuthSession): Promise<void> {
    try {
      await storage.set({ [sessionStorageKey]: session });
    } catch (error) {
      logger.error('Auth storage write error', error);
    }
  }

  async function clearStorage(): Promise<void> {
    try {
      await storage.remove(sessionStorageKey);
    } catch (error) {
      logger.error('Auth storage clear error', error);
    }
  }

  function notify(session: AuthSession | null): void {
    listeners.forEach((cb) => {
      try {
        cb(session);
      } catch (error) {
        logger.error('Auth listener error', error);
      }
    });
  }

  async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
    assertConfig();

    const response = await fetcher(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(response, 'Failed to sign in');
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = (await response.json()) as SupabaseSessionPayload;
    const session = normalizeSession(data);
    await writeStorage(session);
    notify(session);
    return session;
  }

  async function signUpWithEmail(email: string, password: string): Promise<AuthSession> {
    assertConfig();

    const response = await fetcher(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(response, 'Failed to create account');
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = (await response.json()) as SupabaseSessionPayload;

    if (!data?.access_token || !data?.refresh_token) {
      throw createAuthError(
        'Check your email to confirm your account, then sign in.',
        'EMAIL_CONFIRMATION_REQUIRED',
        data,
      );
    }

    const session = normalizeSession(data);
    await writeStorage(session);
    notify(session);
    return session;
  }

  async function refreshSession(
    refreshToken: string,
    existingUser: AuthUser | null = null,
  ): Promise<AuthSession> {
    assertConfig();

    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    const response = await fetcher(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearStorage();
      let errorMessage = 'Failed to refresh session';
      try {
        const errorBody: unknown = await response.json();
        if (typeof errorBody === 'object' && errorBody !== null) {
          const record = errorBody as Record<string, unknown>;
          if (typeof record['error_description'] === 'string') {
            errorMessage = record['error_description'];
          } else if (typeof record['message'] === 'string') {
            errorMessage = record['message'];
          }
        }
      } catch (_) {
        // ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as SupabaseSessionPayload;
    const session = normalizeSession(
      { ...data, refresh_token: data.refresh_token || refreshToken },
      existingUser,
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
      logger.error('Token refresh failed', error);
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
    if (typeof callback !== 'function') {
      return () => {};
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  // Listen to storage changes
  storage.onChanged<AuthSession | null>((changes, areaName) => {
    if (areaName === 'sync' && changes[sessionStorageKey]) {
      const nextSession = changes[sessionStorageKey].newValue ?? null;
      notify(nextSession);
    }
  });

  return {
    signUpWithEmail,
    signInWithEmail,
    signOut,
    getSession,
    getCurrentUser,
    getValidAccessToken,
    getAccessToken: getValidAccessToken,
    onSessionChanged,
  };
}
