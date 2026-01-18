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
  type ErrorEvent,
  type EventHint,
  type Breadcrumb,
} from '@sentry/browser';

// ============================================================================
// Types
// ============================================================================

export type Surface = 'sidebar' | 'content' | 'background' | 'popup';

// ============================================================================
// Configuration
// ============================================================================

// Telemetry opt-out storage key
const TELEMETRY_OPT_OUT_KEY = 'lockin_telemetry_disabled';

// Keys in event.extra that likely contain user content and should be redacted
const SENSITIVE_EXTRA_KEYS =
  /transcript|note|selection|prompt|message|content|chat|caption|text|query|input|output/i;

// Maximum string length before redaction
const MAX_STRING_LENGTH = 500;

// ============================================================================
// Environment Detection
// ============================================================================

// Detect if we're in a service worker (background) or window context
const isServiceWorker =
  typeof self !== 'undefined' && typeof window === 'undefined' && 'ServiceWorkerGlobalScope' in self;

// Get the global context (window or self)
const globalContext: typeof globalThis = isServiceWorker
  ? (self as typeof globalThis)
  : typeof window !== 'undefined'
    ? window
    : globalThis;

/**
 * Check if this is an unpacked/development extension
 * Unpacked extensions don't have update_url in their manifest
 */
function isDevelopmentBuild(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest = (globalContext as any).chrome?.runtime?.getManifest?.();
    // Unpacked extensions don't have update_url
    return !manifest?.update_url;
  } catch {
    return true; // Default to dev if we can't check
  }
}

const isDevelopment = isDevelopmentBuild();

// ============================================================================
// DSN Resolution
// ============================================================================

/**
 * Build-time injected DSN.
 * Vite replaces this with the actual DSN string at build time via the define config.
 * We use a separate constant to avoid complex typeof checks on import.meta which break in service workers.
 */
const BUILD_TIME_DSN: string = import.meta.env.VITE_SENTRY_DSN;

/**
 * Get Sentry DSN from build-time injection or fallback sources
 * Priority:
 * 1. Vite build-time injection via import.meta.env (now via BUILD_TIME_DSN)
 * 2. LOCKIN_CONFIG (for legacy support)
 */
function getSentryDsn(): string | undefined {
  // Primary: Build-time injected DSN (Vite replaces the constant at build)
  if (BUILD_TIME_DSN && BUILD_TIME_DSN !== '' && !BUILD_TIME_DSN.includes('import.meta')) {
    return BUILD_TIME_DSN;
  }

  // Fallback: LOCKIN_CONFIG (for popup/content script where config.js loads first)
  const configDsn = (
    globalContext as typeof globalThis & { LOCKIN_CONFIG?: { SENTRY_DSN?: string } }
  ).LOCKIN_CONFIG?.SENTRY_DSN;
  if (configDsn && configDsn !== '__SENTRY_DSN__' && configDsn !== '') {
    return configDsn;
  }

  return undefined;
}

/**
 * Get extension version from Chrome runtime
 */
function getExtensionVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalContext as any).chrome?.runtime?.getManifest?.()?.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ============================================================================
// Telemetry Opt-Out
// ============================================================================

/**
 * Check if user has opted out of telemetry
 * Returns a promise that resolves to true if telemetry is ENABLED
 */
async function isTelemetryEnabled(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chrome = (globalContext as any).chrome;
    if (!chrome?.storage?.sync) {
      return true; // Default to enabled if storage not available
    }
    const result = await chrome.storage.sync.get([TELEMETRY_OPT_OUT_KEY]);
    return result[TELEMETRY_OPT_OUT_KEY] !== true;
  } catch {
    return true; // Default to enabled on error
  }
}

/**
 * Set telemetry opt-out preference
 */
export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chrome = (globalContext as any).chrome;
    if (chrome?.storage?.sync) {
      await chrome.storage.sync.set({ [TELEMETRY_OPT_OUT_KEY]: !enabled });
    }
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Privacy Scrubbing Utilities
// ============================================================================

/**
 * Strip query parameters from a URL string
 */
function stripQueryParams(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url, 'http://placeholder');
    parsed.search = '';
    parsed.hash = '';
    // Return just the path if it was relative, otherwise full URL
    return url.startsWith('http') ? parsed.toString().replace(/\/$/, '') : parsed.pathname;
  } catch {
    // Fallback: simple split
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Redact long strings in an object (recursive)
 */
function redactLongStrings(obj: unknown, maxLen: number = MAX_STRING_LENGTH): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj.length > maxLen ? `[REDACTED: ${obj.length} chars]` : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactLongStrings(item, maxLen));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactLongStrings(value, maxLen);
    }
    return result;
  }

  return obj;
}

/**
 * Sanitize breadcrumbs to remove sensitive data
 */
function sanitizeBreadcrumbs(breadcrumbs: Breadcrumb[] | undefined): Breadcrumb[] | undefined {
  if (!breadcrumbs) return breadcrumbs;

  return breadcrumbs.map((bc) => {
    const sanitized = { ...bc };
    if (sanitized.data) {
      sanitized.data = { ...sanitized.data };
      // Remove request/response bodies
      delete sanitized.data.body;
      delete sanitized.data.response;
      delete sanitized.data.request;
      delete sanitized.data.responseBody;
      delete sanitized.data.requestBody;
      // Strip query params from URLs
      if (sanitized.data.url) {
        sanitized.data.url = stripQueryParams(sanitized.data.url as string);
      }
      if (sanitized.data.from) {
        sanitized.data.from = stripQueryParams(sanitized.data.from as string);
      }
      if (sanitized.data.to) {
        sanitized.data.to = stripQueryParams(sanitized.data.to as string);
      }
    }
    return sanitized;
  });
}

/**
 * Comprehensive beforeSend scrubbing for privacy
 */
function beforeSendScrubber(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Strip URL query params
  if (event.request?.url) {
    event.request.url = stripQueryParams(event.request.url);
  }

  // Strip query params from transaction name
  if (event.transaction) {
    event.transaction = stripQueryParams(event.transaction) || event.transaction;
  }

  // Redact auth headers
  if (event.request?.headers) {
    delete event.request.headers.Authorization;
    delete event.request.headers.authorization;
    delete event.request.headers.Cookie;
    delete event.request.headers.cookie;
  }

  // Remove cookies
  if (event.request?.cookies) {
    event.request.cookies = {};
  }

  // Redact user content in extras
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_EXTRA_KEYS.test(key)) {
        event.extra[key] = '[REDACTED]';
      }
    }
    // Redact long strings anywhere in extras
    event.extra = redactLongStrings(event.extra) as Record<string, unknown>;
  }

  // Remove user data that might have been attached
  if (event.user) {
    delete event.user.id;
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  // Sanitize breadcrumbs
  event.breadcrumbs = sanitizeBreadcrumbs(event.breadcrumbs);

  return event;
}

// ============================================================================
// Module State
// ============================================================================

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
    if (isDevelopment) {
      console.log(`[Sentry] Already initialized for surface: ${currentSurface}`);
    }
    return true;
  }

  // Check telemetry opt-out
  const telemetryEnabled = await isTelemetryEnabled();
  if (!telemetryEnabled) {
    if (isDevelopment) {
      console.log('[Sentry] Telemetry disabled by user preference');
    }
    return false;
  }

  const dsn = getSentryDsn();

  // Debug logging for troubleshooting
  if (isDevelopment) {
    console.log('[Sentry] Initialization debug:', {
      surface,
      hasDsn: !!dsn,
      dsnPrefix: dsn ? dsn.substring(0, 30) + '...' : 'none',
      isServiceWorker,
      telemetryEnabled,
    });
  }

  if (!dsn) {
    if (isDevelopment) {
      console.log('[Sentry] No DSN configured, skipping initialization');
    }
    return false;
  }

  try {
    // Filter out integrations that use global state (required for browser extensions)
    const integrations = getDefaultIntegrations({}).filter(
      (integration) =>
        !['BrowserApiErrors', 'Breadcrumbs', 'GlobalHandlers'].includes(integration.name),
    );

    const client = new BrowserClient({
      dsn,
      transport: makeFetchTransport,
      stackParser: defaultStackParser,
      integrations,

      // Enable debug mode in development
      debug: isDevelopment,

      // Environment and release
      environment: isDevelopment ? 'development' : 'production',
      release: `lockin-extension@${getExtensionVersion()}`,

      // PRIVACY: Never send PII
      sendDefaultPii: false,

      // Performance: Sample 10% in production
      tracesSampleRate: isDevelopment ? 1.0 : 0.1,

      // Error quality
      attachStacktrace: true,
      normalizeDepth: 5,

      // PRIVACY: Comprehensive scrubbing before send
      beforeSend: (event, _hint) => beforeSendScrubber(event, _hint),

      // Noise filtering
      ignoreErrors: [
        // Extension lifecycle (not actionable)
        'Extension context invalidated',
        'The message port closed',
        'Could not establish connection',
        'Receiving end does not exist',

        // Browser quirks
        'ResizeObserver loop',
        'ResizeObserver loop limit exceeded',

        // Network errors (usually user's connection)
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'Load failed',
        'net::ERR_',

        // User actions
        'AbortError',
        'The operation was aborted',
      ],
    });

    // Create isolated scope for this extension
    sentryScope = new Scope();
    sentryScope.setClient(client);
    sentryClient = client;

    // Set surface tag
    sentryScope.setTag('surface', surface);
    sentryScope.setTag('extensionVersion', getExtensionVersion());
    currentSurface = surface;

    // Initialize client AFTER setting on scope
    client.init();

    // Set up custom error listeners (replaces GlobalHandlers for isolated scope)
    // Only in window context (not service worker)
    if (!isServiceWorker) {
      setupErrorListeners();
    }

    isInitialized = true;

    if (isDevelopment) {
      console.log(`[Sentry] ✓ Initialized successfully for surface: ${surface}`);
    }

    return true;
  } catch (err) {
    // Fail silently - don't break the extension if Sentry fails
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
    if (!sentryClient || !event.error) {
      return;
    }

    // Check if this error comes from our extension context
    const filename = event.filename || '';
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
    if (!sentryClient) {
      return;
    }

    const error =
      event.reason instanceof Error ? event.reason : new Error(String(event.reason));

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chrome = (globalContext as any).chrome;
    if (chrome?.runtime?.onSuspend) {
      chrome.runtime.onSuspend.addListener(() => {
        if (isDevelopment) {
          console.log('[Sentry] Service worker suspending, flushing events...');
        }
        flushSentry(2000);
      });
    }
  } catch {
    // Ignore if chrome.runtime not available
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Capture an error with optional context
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!sentryClient || !sentryScope) {
    if (isDevelopment) {
      console.warn('[Sentry] Not initialized, error not captured:', error);
    }
    return;
  }

  if (context) {
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
  if (!sentryClient) {
    return;
  }
  sentryClient.captureMessage(message, level);
}

/**
 * Set additional context that will be included in error reports
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!sentryScope) {
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
export async function flushSentry(timeout: number = 2000): Promise<void> {
  if (!sentryClient) {
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
  if (!sentryClient) {
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
if (typeof globalContext !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalContext as any).LockInSentry = {
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
}
