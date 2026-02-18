/**
 * Sentry Error Tracking for Lock-in Browser Extension
 *
 * Public API surface stays stable for:
 * - background.js
 * - contentScript-react.js
 * - popup.js
 * - ui/extension/index.tsx
 */

import type { BrowserClient, Scope } from '@sentry/browser';
import { createSentryClient, initializeScope } from './sentry/client';
import { setupWindowErrorListeners } from './sentry/listeners';
import {
  createRuntimeContext,
  DEFAULT_FLUSH_TIMEOUT_MS,
  DSN_PREFIX_LENGTH,
  getSentryDsn,
} from './sentry/runtime';
import {
  isTelemetryEnabled as isTelemetryEnabledForChrome,
  setTelemetryEnabled as setTelemetryEnabledForChrome,
} from './sentry/telemetry';
import { isNonEmptyString } from './sentry/utils';
import {
  SENTRY_SURFACES,
  type LockInSentryApi,
  type SentryMessageLevel,
  type Surface,
} from './sentry/types';

const { globalWithChrome, isServiceWorker, isDevelopment, shouldLogDebug } = createRuntimeContext();

let sentryScope: Scope | null = null;
let sentryClient: BrowserClient | null = null;
let isInitialized = false;
let currentSurface: Surface | null = null;

function logDebug(message: string, context?: Record<string, unknown>): void {
  if (!shouldLogDebug) {
    return;
  }
  if (context !== undefined) {
    console.log(message, context);
    return;
  }
  console.log(message);
}

function logInitDebug(surface: Surface, dsn: string | undefined, telemetryEnabled: boolean): void {
  if (!shouldLogDebug) {
    return;
  }
  const dsnValue = isNonEmptyString(dsn) ? dsn : undefined;
  const hasDsn = dsnValue !== undefined;
  const dsnPrefix = hasDsn ? `${dsnValue.substring(0, DSN_PREFIX_LENGTH)}...` : 'none';

  logDebug('[Sentry] Initialization debug:', {
    surface,
    hasDsn,
    dsnPrefix,
    isServiceWorker,
    telemetryEnabled,
  });
}

export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  await setTelemetryEnabledForChrome(globalWithChrome.chrome, enabled);
}

async function resolveDsnForInit(surface: Surface): Promise<string | null> {
  const telemetryEnabled = await isTelemetryEnabledForChrome(globalWithChrome.chrome);
  if (telemetryEnabled === false) {
    logDebug('[Sentry] Telemetry disabled by user preference');
    return null;
  }

  const dsn = getSentryDsn(globalWithChrome);
  logInitDebug(surface, dsn, telemetryEnabled);

  if (!isNonEmptyString(dsn)) {
    logDebug('[Sentry] No DSN configured, skipping initialization');
    return null;
  }

  return dsn;
}

export async function initSentry(surface: Surface): Promise<boolean> {
  if (!SENTRY_SURFACES.includes(surface)) {
    return false;
  }

  if (isInitialized) {
    logDebug(`[Sentry] Already initialized for surface: ${currentSurface}`);
    return true;
  }

  const dsn = await resolveDsnForInit(surface);
  if (dsn === null) {
    return false;
  }

  try {
    const client = createSentryClient({ dsn, isDevelopment, globalWithChrome });
    sentryScope = initializeScope(client, surface, globalWithChrome);
    sentryClient = client;
    currentSurface = surface;

    if (!isServiceWorker) {
      setupWindowErrorListeners(client, isDevelopment);
    }

    isInitialized = true;
    logDebug(`[Sentry] Initialized successfully for surface: ${surface}`);
    return true;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
    return false;
  }
}

export function setupMv3Lifecycle(): void {
  try {
    const onSuspend = globalWithChrome.chrome?.runtime?.onSuspend;
    if (onSuspend !== undefined) {
      onSuspend.addListener(() => {
        logDebug('[Sentry] Service worker suspending, flushing events...');
        void flushSentry(DEFAULT_FLUSH_TIMEOUT_MS);
      });
    }
  } catch {
    // Ignore if chrome.runtime is unavailable.
  }
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (sentryClient === null || sentryScope === null) {
    if (shouldLogDebug) {
      console.warn('[Sentry] Not initialized, error not captured:', error);
    }
    return;
  }

  if (context !== undefined) {
    sentryScope.setExtras(context);
  }

  sentryClient.captureException(error, { captureContext: sentryScope });
}

export function captureMessage(message: string, level: SentryMessageLevel = 'info'): void {
  if (sentryClient === null) {
    return;
  }
  sentryClient.captureMessage(message, level);
}

export function setContext(name: string, context: Record<string, unknown>): void {
  if (sentryScope === null) {
    return;
  }
  sentryScope.setContext(name, context);
}

export function getSentryScope(): Scope | null {
  return sentryScope;
}

export function isSentryInitialized(): boolean {
  return isInitialized;
}

export async function flushSentry(timeout: number = DEFAULT_FLUSH_TIMEOUT_MS): Promise<void> {
  if (sentryClient === null) {
    return;
  }
  try {
    await sentryClient.flush(timeout);
  } catch {
    // Ignore flush errors.
  }
}

export function sendTestEvents(): { success: boolean; message: string } {
  if (sentryClient === null) {
    return { success: false, message: 'Sentry not initialized' };
  }

  try {
    sentryClient.captureMessage(`Sentry test message from ${currentSurface}`, 'info');
    sentryClient.captureException(new Error(`Sentry test error from ${currentSurface}`));
    return { success: true, message: `Test events sent from ${currentSurface}` };
  } catch (error) {
    return { success: false, message: `Failed to send: ${error}` };
  }
}

const sentryApi: LockInSentryApi = {
  initSentry,
  captureError,
  captureMessage,
  setContext,
  getSentryScope,
  isSentryInitialized,
  flushSentry,
  sendTestEvents,
  setTelemetryEnabled,
  setupMv3Lifecycle,
};

globalWithChrome.LockInSentry = sentryApi;
