import type { Scope } from '@sentry/browser';
import type { ChromeLike } from './chromeTypes';

export const SENTRY_SURFACES = ['sidebar', 'content', 'background', 'popup'] as const;

export type Surface = (typeof SENTRY_SURFACES)[number];

export type SentryMessageLevel = 'info' | 'warning' | 'error';

export type LockInSentryApi = {
  initSentry: (surface: Surface) => Promise<boolean>;
  captureError: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: SentryMessageLevel) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  getSentryScope: () => Scope | null;
  isSentryInitialized: () => boolean;
  flushSentry: (timeout?: number) => Promise<void>;
  sendTestEvents: () => { success: boolean; message: string };
  setTelemetryEnabled: (enabled: boolean) => Promise<void>;
  setupMv3Lifecycle: () => void;
};

export type GlobalWithChrome = typeof globalThis & {
  chrome?: ChromeLike;
  LOCKIN_CONFIG?: { SENTRY_DSN?: string };
  LockInSentry?: LockInSentryApi;
};
