import type { LockInContentRuntime } from './contentRuntime';
import type { Logger } from './logger';
import type { Messaging } from './messaging';
import type { Storage } from './storage';
import type { AuthClient } from '../../api/auth';
import type { ApiClient } from '../../api/client';

export type LockInConfig = {
  APP_ENV: string;
  IS_PRODUCTION: boolean;
  BACKEND_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_ENVIRONMENT: 'development' | 'production';
  SESSION_STORAGE_KEY: string;
  TOKEN_EXPIRY_BUFFER_MS: number;
  DEBUG_PANOPTO_RESOLVER: boolean;
  DEBUG?: string | boolean;
  SENTRY_DSN?: string;
};

declare global {
  interface Window {
    LOCKIN_CONFIG?: Partial<LockInConfig>;
    LockInContent?: LockInContentRuntime;
    LockInLogger?: Logger;
    LockInMessaging?: Messaging;
    LockInStorage?: Storage;
    LockInAuth?: AuthClient;
    LockInAPI?: ApiClient;
    LockInNetworkRetry?: {
      fetchWithRetry: (
        url: string,
        options?: RequestInit,
        config?: {
          maxRetries?: number;
          baseDelayMs?: number;
          maxDelayMs?: number;
          timeoutMs?: number;
          retryableStatuses?: number[];
          retryOnServerError?: boolean;
          retryOnNetworkError?: boolean;
          retryOnTimeout?: boolean;
          context?: string;
        },
      ) => Promise<Response>;
      DEFAULT_RETRY_CONFIG?: {
        maxRetries: number;
        baseDelayMs: number;
        maxDelayMs: number;
        timeoutMs: number;
      };
    };
    authClient?: AuthClient;
    apiClient?: ApiClient;
  }
}

export {};
