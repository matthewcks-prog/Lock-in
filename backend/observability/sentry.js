/**
 * Sentry Error Tracking for Lock-in Backend
 *
 * Captures unhandled errors, request failures, and performance metrics.
 * Privacy-first: all request bodies, query params, and auth headers are stripped.
 *
 * Setup:
 * 1. Create a Sentry project (select "Express" as platform)
 * 2. Copy the DSN
 * 3. Add SENTRY_DSN to your .env file
 */

const Sentry = require('@sentry/node');
const { logger } = require('./index');
const { ONE, TWO, TEN, THIRTY, THOUSAND } = require('../constants/numbers');

const isDevelopment = process.env.NODE_ENV !== 'production';
const TRACE_SAMPLE_RATE_DEV = ONE;
const TRACE_SAMPLE_RATE_PROD = ONE / TEN;
const DSN_PREFIX_LENGTH = THIRTY;
const DEFAULT_FLUSH_TIMEOUT_MS = THOUSAND * TWO;

/**
 * Check if Sentry should be completely disabled.
 * Set SENTRY_ENABLED=false to disable Sentry entirely (useful during active development).
 * By default, Sentry is enabled in production and development (if DSN is provided).
 */
function isSentryEnabled() {
  // Explicit disable via env var takes precedence
  if (process.env.SENTRY_ENABLED === 'false') {
    return false;
  }
  // In development, require explicit opt-in OR DSN presence
  // Default: enabled if DSN is present
  return true;
}

/**
 * Strip query parameters from a URL string
 */
function stripQueryParams(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url, 'http://placeholder');
    parsed.search = '';
    // Return just the path if it was relative, otherwise full URL
    return url.startsWith('http') ? parsed.toString() : parsed.pathname;
  } catch {
    // Fallback: simple split
    return url.split('?')[0];
  }
}

function sanitizeRequest(request) {
  if (!request) {
    return;
  }

  if (request.url) {
    request.url = stripQueryParams(request.url);
  }

  if (request.data) {
    request.data = '[REDACTED]';
  }

  if (request.headers) {
    delete request.headers.Authorization;
    delete request.headers.authorization;
    delete request.headers.Cookie;
    delete request.headers.cookie;
    delete request.headers['x-api-key'];
    delete request.headers['x-auth-token'];
  }

  if (request.cookies) {
    request.cookies = '[REDACTED]';
  }

  if (request.query_string) {
    request.query_string = '[REDACTED]';
  }
}

function sanitizeBreadcrumbs(breadcrumbs) {
  if (!Array.isArray(breadcrumbs)) {
    return breadcrumbs;
  }

  return breadcrumbs.map((breadcrumb) => {
    if (breadcrumb.data) {
      delete breadcrumb.data.body;
      delete breadcrumb.data.response;
      delete breadcrumb.data.request;
      if (breadcrumb.data.url) {
        breadcrumb.data.url = stripQueryParams(breadcrumb.data.url);
      }
    }
    return breadcrumb;
  });
}

function sanitizeUser(user) {
  if (!user) {
    return;
  }

  delete user.email;
  delete user.username;
  delete user.ip_address;
}

function sanitizeSentryEvent(event) {
  if (event.request) {
    sanitizeRequest(event.request);
  }

  if (event.transaction) {
    event.transaction = stripQueryParams(event.transaction);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = sanitizeBreadcrumbs(event.breadcrumbs);
  }

  if (event.user) {
    sanitizeUser(event.user);
  }

  return event;
}

function buildSentryOptions(dsn) {
  return {
    dsn,
    environment: isDevelopment ? 'development' : 'production',
    release: `lockin-backend@${process.env.npm_package_version || '1.0.0'}`,

    // Performance monitoring: sample 10% of transactions in production
    tracesSampleRate: isDevelopment ? TRACE_SAMPLE_RATE_DEV : TRACE_SAMPLE_RATE_PROD,

    // PRIVACY: Never send PII
    sendDefaultPii: false,

    // Filter out common noise
    ignoreErrors: [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'Network request failed',
      'ENOTFOUND',
      'ECONNRESET',
    ],

    // PRIVACY: Strip sensitive data before sending
    beforeSend: sanitizeSentryEvent,
  };
}

function logSentryDebugInfo({ dsn, enabled }) {
  if (!isDevelopment) {
    return;
  }

  logger.debug(
    {
      hasDsn: !!dsn,
      dsnPrefix: dsn ? dsn.substring(0, DSN_PREFIX_LENGTH) + '...' : 'none',
      nodeEnv: process.env.NODE_ENV || 'undefined',
      sentryEnabled: enabled,
    },
    '[Sentry] Initialization debug',
  );
}

/**
 * Initialize Sentry for the backend
 * Call this BEFORE setting up Express middleware
 *
 * Sentry SDK v8+ uses automatic instrumentation - no explicit request handler needed.
 * Error handler is set up via Sentry.setupExpressErrorHandler(app) after all routes.
 *
 * @returns {boolean} Whether Sentry was successfully initialized
 */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const enabled = isSentryEnabled();

  // Debug logging for troubleshooting
  logSentryDebugInfo({ dsn, enabled });

  // Check if explicitly disabled
  if (!enabled) {
    logger.info('[Sentry] Disabled via SENTRY_ENABLED=false, skipping initialization');
    return false;
  }

  if (!dsn) {
    if (isDevelopment) {
      logger.debug('[Sentry] No DSN configured, skipping initialization');
    }
    return false;
  }

  try {
    Sentry.init(buildSentryOptions(dsn));

    logger.info(`[Sentry] Initialized for ${isDevelopment ? 'development' : 'production'}`);
    return true;
  } catch (err) {
    logger.error({ err }, '[Sentry] Failed to initialize');
    return false;
  }
}

/**
 * Set up Sentry error handler for Express
 * Call this AFTER all routes but BEFORE your custom error handler
 *
 * @param {import('express').Application} app - Express app instance
 */
function setupSentryErrorHandler(app) {
  if (Sentry.isInitialized()) {
    Sentry.setupExpressErrorHandler(app);
  }
}

/**
 * Manually capture an error
 */
function captureError(error, context = {}) {
  Sentry.captureException(error, { extra: context });
}

/**
 * Capture a message (for non-error events)
 */
function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Flush pending events (call before process exit)
 */
async function flush(timeout = DEFAULT_FLUSH_TIMEOUT_MS) {
  try {
    await Sentry.flush(timeout);
  } catch {
    // Ignore flush errors
  }
}

module.exports = {
  initSentry,
  setupSentryErrorHandler,
  captureError,
  captureMessage,
  flush,
  Sentry,
};
