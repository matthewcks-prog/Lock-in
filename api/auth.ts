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
import { resolveFetch } from './fetcher/setup';
import {
  createRefreshSession,
  createSignInWithEmail,
  createSignUpWithEmail,
} from './auth/authOperations';
import { createAuthStorageManager } from './auth/authStorage';
import {
  DEFAULT_SESSION_STORAGE_KEY,
  DEFAULT_TOKEN_EXPIRY_BUFFER_MS,
  createConfigAssert,
  createSessionHandlers,
  createSessionNotifier,
} from './auth/authClientUtils';

export type AuthConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sessionStorageKey?: string;
  tokenExpiryBufferMs?: number;
};

export type AuthClient = {
  signUpWithEmail(email: string, password: string): Promise<AuthSession>;
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthUser | null>;
  getValidAccessToken(): Promise<string | null>;
  getAccessToken(): Promise<string | null>;
  onSessionChanged(callback: (session: AuthSession | null) => void): () => void;
};

export type AuthDependencies = {
  fetcher?: FetchLike;
  logger?: Logger;
};
/**
 * Create Supabase auth client
 */
export function createAuthClient(
  config: AuthConfig,
  storage: StorageInterface,
  deps: AuthDependencies = {},
): AuthClient {
  const { supabaseUrl, supabaseAnonKey } = config;
  const sessionStorageKey = config.sessionStorageKey ?? DEFAULT_SESSION_STORAGE_KEY;
  const tokenExpiryBufferMs = config.tokenExpiryBufferMs ?? DEFAULT_TOKEN_EXPIRY_BUFFER_MS;
  const fetcher = resolveFetch(deps.fetcher);
  const logger = deps.logger ?? createLogger('Auth');
  const { notify, onSessionChanged } = createSessionNotifier(logger);
  const assertConfig = createConfigAssert(supabaseUrl, supabaseAnonKey);

  const storageManager = createAuthStorageManager({ storage, sessionStorageKey, logger, notify });
  const sharedDeps = {
    supabaseUrl,
    supabaseAnonKey,
    fetcher,
    assertConfig,
    writeStorage: storageManager.writeSession,
    clearStorage: storageManager.clearSession,
    notify,
  };
  const signInWithEmail = createSignInWithEmail(sharedDeps);
  const signUpWithEmail = createSignUpWithEmail(sharedDeps);
  const refreshSession = createRefreshSession(sharedDeps);

  const { getSession, getCurrentUser, getValidAccessToken, signOut } = createSessionHandlers({
    storageManager,
    refreshSession,
    tokenExpiryBufferMs,
    logger,
    notify,
  });
  storageManager.listen();
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
