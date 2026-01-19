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

const isDevelopment = process.env.NODE_ENV !== 'production';

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
  if (isDevelopment) {
    console.log('[Sentry] Initialization debug:', {
      hasDsn: !!dsn,
      dsnPrefix: dsn ? dsn.substring(0, 30) + '...' : 'none',
      nodeEnv: process.env.NODE_ENV || 'undefined',
      sentryEnabled: enabled,
    });
  }

  // Check if explicitly disabled
  if (!enabled) {
    console.log('[Sentry] Disabled via SENTRY_ENABLED=false, skipping initialization');
    return false;
  }

  if (!dsn) {
    if (isDevelopment) {
      console.log('[Sentry] No DSN configured, skipping initialization');
    }
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: isDevelopment ? 'development' : 'production',
      release: `lockin-backend@${process.env.npm_package_version || '1.0.0'}`,

      // Performance monitoring: sample 10% of transactions in production
      tracesSampleRate: isDevelopment ? 1.0 : 0.1,

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
      beforeSend(event) {
        // Strip query params from request URL
        if (event.request) {
          if (event.request.url) {
            event.request.url = stripQueryParams(event.request.url);
          }

          // PRIVACY: Redact request body entirely (may contain chat/transcript/note/user content)
          if (event.request.data) {
            event.request.data = '[REDACTED]';
          }

          // PRIVACY: Remove auth headers and cookies
          if (event.request.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.authorization;
            delete event.request.headers.Cookie;
            delete event.request.headers.cookie;
            delete event.request.headers['x-api-key'];
            delete event.request.headers['x-auth-token'];
          }

          // Remove cookies object
          if (event.request.cookies) {
            event.request.cookies = '[REDACTED]';
          }

          // Strip query params from query_string
          if (event.request.query_string) {
            event.request.query_string = '[REDACTED]';
          }
        }

        // Strip query params from transaction name
        if (event.transaction) {
          event.transaction = stripQueryParams(event.transaction);
        }

        // Sanitize breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((bc) => {
            if (bc.data) {
              // Remove potentially sensitive data from breadcrumbs
              delete bc.data.body;
              delete bc.data.response;
              delete bc.data.request;
              // Strip query params from breadcrumb URLs
              if (bc.data.url) {
                bc.data.url = stripQueryParams(bc.data.url);
              }
            }
            return bc;
          });
        }

        // Remove any user data that might have been attached
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
          delete event.user.ip_address;
        }

        return event;
      },
    });

    console.log(`[Sentry] ✓ Initialized for ${isDevelopment ? 'development' : 'production'}`);
    return true;
  } catch (err) {
    console.error('[Sentry] Failed to initialize:', err);
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
 * Set user context (anonymized - ID only)
 */
function setUser(userId) {
  // Only set user ID, no email or name for privacy
  Sentry.setUser({ id: userId });
}

/**
 * Clear user context (on logout)
 */
function clearUser() {
  Sentry.setUser(null);
}

/**
 * Flush pending events (call before process exit)
 */
async function flush(timeout = 2000) {
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
  setUser,
  clearUser,
  flush,
  Sentry,
};
