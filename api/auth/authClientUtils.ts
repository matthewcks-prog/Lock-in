import type { AuthSession, AuthUser } from '../../core/domain/types';
import type { Logger } from '../../core/utils/logger';
import type { AuthStorageManager } from './authStorage';

export const DEFAULT_SESSION_STORAGE_KEY = 'lockinSupabaseSession';
export const DEFAULT_TOKEN_EXPIRY_BUFFER_MS = 60000;

export type SessionNotifier = {
  notify: (session: AuthSession | null) => void;
  onSessionChanged: (callback: (session: AuthSession | null) => void) => () => void;
};

export type SessionHandlers = {
  getSession: () => Promise<AuthSession | null>;
  getCurrentUser: () => Promise<AuthUser | null>;
  getValidAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

type RefreshSession = (refreshToken: string, existingUser: AuthUser | null) => Promise<AuthSession>;
type SessionHandlerDeps = {
  storageManager: AuthStorageManager;
  refreshSession: RefreshSession;
  tokenExpiryBufferMs: number;
  logger: Logger;
  notify: (session: AuthSession | null) => void;
};

export function createSessionNotifier(logger: Logger): SessionNotifier {
  const listeners = new Set<(session: AuthSession | null) => void>();

  const notify = (session: AuthSession | null): void => {
    listeners.forEach((cb) => {
      try {
        cb(session);
      } catch (error) {
        logger.error('Auth listener error', error);
      }
    });
  };

  const onSessionChanged = (callback: (session: AuthSession | null) => void): (() => void) => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  return { notify, onSessionChanged };
}

export function createConfigAssert(supabaseUrl: string, supabaseAnonKey: string): () => void {
  return () => {
    if (supabaseUrl.trim().length === 0 || supabaseAnonKey.trim().length === 0) {
      throw new Error('Supabase URL or anon key is not configured');
    }
  };
}

export function createSessionHandlers({
  storageManager,
  refreshSession,
  tokenExpiryBufferMs,
  logger,
  notify,
}: SessionHandlerDeps): SessionHandlers {
  const getSession = async (): Promise<AuthSession | null> => storageManager.readSession();

  const getValidAccessToken = async (): Promise<string | null> => {
    const session = await storageManager.readSession();
    if (session === null) {
      return null;
    }

    const expiresAt = Number.isFinite(session.expiresAt) ? session.expiresAt : 0;
    if (expiresAt - tokenExpiryBufferMs > Date.now()) {
      return session.accessToken;
    }

    try {
      const refreshed = await refreshSession(session.refreshToken, session.user);
      return refreshed.accessToken;
    } catch (error) {
      logger.error('Token refresh failed', error);
      return null;
    }
  };

  const getCurrentUser = async (): Promise<AuthUser | null> => {
    const session = await getSession();
    return session?.user ?? null;
  };

  const signOut = async (): Promise<void> => {
    await storageManager.clearSession();
    notify(null);
  };

  return { getSession, getCurrentUser, getValidAccessToken, signOut };
}
