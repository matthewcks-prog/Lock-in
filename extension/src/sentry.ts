/**
 * Sentry Error Tracking for Lock-in Browser Extension
 *
 * Uses the browser extension pattern with manual BrowserClient + Scope setup
 * per Sentry best practices. See:
 * https://docs.sentry.io/platforms/javascript/best-practices/browser-extensions/
 *
 * Privacy:
 * - No user IDs sent (anonymous error tracking)
 * - Query params stripped from all URLs
 * - Request/response bodies redacted
 * - Auth headers removed
 * - Long strings and user content keys redacted
 *
 * Surfaces:
 * - sidebar: React sidebar UI (ui/extension/index.tsx)
 * - content: Content script orchestrator (contentScript-react.js)
 * - background: MV3 service worker (background.js)
 * - popup: Popup settings page (popup.js)
 */

import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from '@sentry/browser';
import type { ChromeLike } from './sentry/chromeTypes';
import { beforeSendScrubber } from './sentry/privacy';
import {
  isTelemetryEnabled as isTelemetryEnabledForChrome,
  setTelemetryEnabled as setTelemetryEnabledForChrome,
} from './sentry/telemetry';
import { getExtensionVersion, getMetaEnvString, isNonEmptyString } from './sentry/utils';

export { setTelemetryEnabled };

export type Surface = 'sidebar' | 'content' | 'background' | 'popup';

type GlobalWithChrome = typeof globalThis & {
  chrome?: ChromeLike;
  LOCKIN_CONFIG?: { SENTRY_DSN?: string };
  LockInSentry?: LockInSentryApi;
};

type LockInSentryApi = {
  initSentry: (surface: Surface) => Promise<boolean>;
  captureError: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  getSentryScope: () => Scope | null;
  isSentryInitialized: () => boolean;
  flushSentry: (timeout?: number) => Promise<void>;
  sendTestEvents: () => { success: boolean; message: string };
  setTelemetryEnabled: (enabled: boolean) => Promise<void>;
  setupMv3Lifecycle: () => void;
};

// ============================================================================
// Configuration
// ============================================================================

const DSN_PREFIX_LENGTH = 30;
const PROD_TRACES_SAMPLE_RATE = 0.1;
const DEFAULT_FLUSH_TIMEOUT_MS = 2000;

// ============================================================================
// Environment Detection
// ============================================================================

// Detect if we're in a service worker (background) or window context
const isServiceWorker =
  typeof self !== 'undefined' &&
  typeof window === 'undefined' &&
  'ServiceWorkerGlobalScope' in self;

// Get the global context (window or self)
const globalContext: typeof globalThis = isServiceWorker
  ? (self as typeof globalThis)
  : typeof window !== 'undefined'
    ? window
    : globalThis;
const globalWithChrome = globalContext as GlobalWithChrome;

/**
 * Check if this is an unpacked/development extension
 * Unpacked extensions don't have update_url in their manifest
 */
function isDevelopmentBuild(): boolean {
  try {
    const manifest = globalWithChrome.chrome?.runtime?.getManifest?.();
    // Unpacked extensions don't have update_url
    const updateUrl = manifest?.update_url;
    return !isNonEmptyString(updateUrl);
  } catch {
    return true; // Default to dev if we can't check
  }
}

const isDevelopment = isDevelopmentBuild();
const isTestEnv =
  typeof process !== 'undefined' &&
  (process.env?.['NODE_ENV'] === 'test' ||
    process.env?.['VITEST'] === 'true' ||
    process.env?.['VITEST'] === '1');
const shouldLogDebug = isDevelopment && !isTestEnv;

// ============================================================================
// DSN Resolution
// ============================================================================

/**
 * Build-time injected DSN.
 * Vite replaces this with the actual DSN string at build time via the define config.
 * We use a separate constant to avoid complex typeof checks on import.meta which break in service workers.
 */
const BUILD_TIME_DSN = getMetaEnvString('VITE_SENTRY_DSN');

/**
 * Get Sentry DSN from build-time injection or fallback sources
 * Priority:
 * 1. Vite build-time injection via import.meta.env (now via BUILD_TIME_DSN)
 * 2. LOCKIN_CONFIG (for legacy support)
 */
function getSentryDsn(): string | undefined {
  // Primary: Build-time injected DSN (Vite replaces the constant at build)
  const buildTimeDsn = BUILD_TIME_DSN;
  if (isNonEmptyString(buildTimeDsn) && !buildTimeDsn.includes('import.meta')) {
    return buildTimeDsn;
  }

  // Fallback: LOCKIN_CONFIG (for popup/content script where config.js loads first)
  const configDsn = globalWithChrome.LOCKIN_CONFIG?.SENTRY_DSN;
  if (isNonEmptyString(configDsn) && configDsn !== '__SENTRY_DSN__') {
    return configDsn;
  }

  return undefined;
}

/**
 * Get extension version from Chrome runtime
 */
async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  await setTelemetryEnabledForChrome(globalWithChrome.chrome, enabled);
}

function logDebug(message: string, context?: Record<string, unknown>): void {
  if (!shouldLogDebug) return;
  if (context !== undefined) {
    console.log(message, context);
    return;
  }
  console.log(message);
}

function logInitDebug(surface: Surface, dsn: string | undefined, telemetryEnabled: boolean): void {
  if (!shouldLogDebug) return;
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

function getSentryIntegrations(): ReturnType<typeof getDefaultIntegrations> {
  return getDefaultIntegrations({}).filter(
    (integration) =>
      !['BrowserApiErrors', 'Breadcrumbs', 'GlobalHandlers'].includes(integration.name),
  );
}

function createSentryClient(dsn: string): BrowserClient {
  const extensionVersion = getExtensionVersion(globalWithChrome.chrome);
  return new BrowserClient({
    dsn,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: getSentryIntegrations(),
    debug: isDevelopment,
    environment: isDevelopment ? 'development' : 'production',
    release: `lockin-extension@${extensionVersion}`,
    sendDefaultPii: false,
    tracesSampleRate: isDevelopment ? 1.0 : PROD_TRACES_SAMPLE_RATE,
    attachStacktrace: true,
    normalizeDepth: 5,
    beforeSend: beforeSendScrubber,
    ignoreErrors: [
      'Extension context invalidated',
      'The message port closed',
      'Could not establish connection',
      'Receiving end does not exist',
      'ResizeObserver loop',
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      'net::ERR_',
      'AbortError',
      'The operation was aborted',
    ],
  });
}

function initializeScope(client: BrowserClient, surface: Surface): void {
  sentryScope = new Scope();
  sentryScope.setClient(client);
  sentryClient = client;
  sentryScope.setTag('surface', surface);
  sentryScope.setTag('extensionVersion', getExtensionVersion(globalWithChrome.chrome));
  currentSurface = surface;
  client.init();
}

async function resolveDsnForInit(surface: Surface): Promise<string | null> {
  const telemetryEnabled = await isTelemetryEnabledForChrome(globalWithChrome.chrome);
  if (telemetryEnabled === false) {
    logDebug('[Sentry] Telemetry disabled by user preference');
    return null;
  }

  const dsn = getSentryDsn();
  logInitDebug(surface, dsn, telemetryEnabled);

  if (!isNonEmptyString(dsn)) {
    logDebug('[Sentry] No DSN configured, skipping initialization');
    return null;
  }

  return dsn;
}

let sentryScope: Scope | null = null;
let sentryClient: BrowserClient | null = null;
let isInitialized = false;
let currentSurface: Surface | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize Sentry error tracking for the browser extension.
 * Uses isolated BrowserClient + Scope (not Sentry.init) per browser extension best practices.
 *
 * @param surface - Surface identifier for error grouping
 * @returns Promise that resolves to true if initialization succeeded
 */
export async function initSentry(surface: Surface): Promise<boolean> {
  if (isInitialized) {
    logDebug(`[Sentry] Already initialized for surface: ${currentSurface}`);
    return true;
  }

  const dsn = await resolveDsnForInit(surface);
  if (dsn === null) {
    return false;
  }

  try {
    const client = createSentryClient(dsn);
    initializeScope(client, surface);

    if (!isServiceWorker) {
      setupErrorListeners();
    }

    isInitialized = true;
    logDebug(`[Sentry] Initialized successfully for surface: ${surface}`);

    return true;
  } catch (err) {
    console.error('[Sentry] Failed to initialize:', err);
    return false;
  }
}

// ============================================================================
// Error Listeners
// ============================================================================

/**
 * Set up custom error listeners for unhandled errors.
 * Since we removed GlobalHandlers (required for browser extensions),
 * we add our own listeners that route to the isolated scope.
 */
function setupErrorListeners(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    if (sentryClient === null || event.error === undefined || event.error === null) {
      return;
    }

    // Check if this error comes from our extension context
    const filename = event.filename ?? '';
    const isOurError =
      filename.includes('chrome-extension://') ||
      filename.includes('dist/ui/') ||
      filename.includes('dist/libs/') ||
      filename.includes('extension/');

    if (isOurError || isDevelopment) {
      sentryClient.captureException(event.error);
    }
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (sentryClient === null) {
      return;
    }

    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    sentryClient.captureException(error);
  });
}

// ============================================================================
// MV3 Lifecycle (Service Worker)
// ============================================================================

/**
 * Set up MV3 service worker lifecycle handlers.
 * Call this from background.js after initSentry('background').
 * Ensures pending events are flushed before the service worker suspends.
 */
export function setupMv3Lifecycle(): void {
  try {
    const chrome = globalWithChrome.chrome;
    const onSuspend = chrome?.runtime?.onSuspend;
    if (onSuspend !== undefined) {
      onSuspend.addListener(() => {
        logDebug('[Sentry] Service worker suspending, flushing events...');
        void flushSentry(DEFAULT_FLUSH_TIMEOUT_MS);
      });
    }
  } catch {
    // Ignore if chrome.runtime not available
  }
}

/**
 * Capture an error with optional context
 */
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

  // Use client.captureException with scope hint for isolated BrowserClient pattern
  sentryClient.captureException(error, { captureContext: sentryScope });
}

/**
 * Capture a message (for non-error events)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (sentryClient === null) {
    return;
  }
  sentryClient.captureMessage(message, level);
}

/**
 * Set additional context that will be included in error reports
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (sentryScope === null) {
    return;
  }
  sentryScope.setContext(name, context);
}

/**
 * Get the Sentry scope (for advanced usage)
 */
export function getSentryScope(): Scope | null {
  return sentryScope;
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

/**
 * Flush pending events
 * Call this before the service worker suspends or page unloads
 */
export async function flushSentry(timeout: number = DEFAULT_FLUSH_TIMEOUT_MS): Promise<void> {
  if (sentryClient === null) {
    return;
  }
  try {
    await sentryClient.flush(timeout);
  } catch {
    // Ignore flush errors
  }
}

/**
 * Test function to verify Sentry is working.
 * Sends both a message and an error to verify integration.
 */
export function sendTestEvents(): { success: boolean; message: string } {
  if (sentryClient === null) {
    return { success: false, message: 'Sentry not initialized' };
  }

  try {
    // Send test message
    sentryClient.captureMessage(`Sentry test message from ${currentSurface}`, 'info');

    // Send test error
    const testError = new Error(`Sentry test error from ${currentSurface}`);
    sentryClient.captureException(testError);

    return { success: true, message: `Test events sent from ${currentSurface}` };
  } catch (err) {
    return { success: false, message: `Failed to send: ${err}` };
  }
}

// ============================================================================
// Global Exposure (for non-bundled consumers like popup.js)
// ============================================================================

// Expose on global context for popup.js and other non-bundled scripts
globalWithChrome.LockInSentry = {
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
