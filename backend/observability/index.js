/**
 * Unified Observability Module for Lock-in Backend
 *
 * Provides:
 * - Application Insights (Azure-native APM)
 * - Structured logging with pino
 * - Correlation ID propagation
 * - LLM token usage tracking
 *
 * IMPORTANT: This module must be loaded FIRST in index.js, before any other imports.
 * Application Insights needs to instrument Node.js modules before they're loaded.
 */

const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const shouldLoadAppInsights = Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);
const appInsights = shouldLoadAppInsights ? require('applicationinsights') : null;

const pinoPackagePath = resolve(__dirname, '../node_modules/pino/package.json');
const pinoRootPath = resolve(process.cwd(), 'node_modules/pino/package.json');
const pino = existsSync(pinoPackagePath) || existsSync(pinoRootPath) ? require('pino') : null;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');

// =============================================================================
// Application Insights Setup
// =============================================================================

let appInsightsClient = null;
let appInsightsInitialized = false;
let isShuttingDown = false;

/**
 * Suppress OpenTelemetry MeterProvider warnings in development.
 * These warnings are harmless and occur during nodemon hot-reloads because
 * the OpenTelemetry SDK's shutdown is called multiple times.
 */
function suppressOTelWarningsInDev() {
  if (IS_PRODUCTION) return;

  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  const shouldSuppress = (args) => {
    const message = args[0];
    if (typeof message !== 'string') return false;
    return (
      message.includes('shutdown may only be called once per MeterProvider') ||
      message.includes('shutdown may only be called once per TracerProvider')
    );
  };

  console.log = (...args) => {
    if (!shouldSuppress(args)) originalConsoleLog.apply(console, args);
  };
  console.warn = (...args) => {
    if (!shouldSuppress(args)) originalConsoleWarn.apply(console, args);
  };
  console.error = (...args) => {
    if (!shouldSuppress(args)) originalConsoleError.apply(console, args);
  };
}

// Apply suppression immediately on module load (before App Insights init)
suppressOTelWarningsInDev();

/**
 * Initialize Application Insights for Azure-native APM.
 * Call this FIRST, before any other imports in index.js.
 *
 * Set APPLICATIONINSIGHTS_CONNECTION_STRING in your environment.
 * Get the connection string from Azure Portal -> Application Insights -> Overview -> Connection String
 *
 * @returns {boolean} Whether App Insights was initialized
 */
function initApplicationInsights() {
  // Prevent double-initialization (causes MeterProvider warnings with nodemon)
  if (appInsightsInitialized) {
    console.log('[AppInsights] Already initialized, skipping');
    return Boolean(appInsightsClient);
  }

  if (!appInsights) {
    if (!IS_PRODUCTION) {
      console.log('[AppInsights] Module not loaded, skipping initialization');
    }
    appInsightsInitialized = true;
    return false;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    if (!IS_PRODUCTION) {
      console.log('[AppInsights] No connection string configured, skipping initialization');
    }
    appInsightsInitialized = true; // Mark as "handled" to prevent retry
    return false;
  }

  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, false) // false = disable deprecated extended metrics
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true) // Capture console.log as traces
      .setAutoCollectPreAggregatedMetrics(true)
      .setSendLiveMetrics(IS_PRODUCTION) // Live metrics stream in production
      .setUseDiskRetryCaching(true)
      .setInternalLogging(false, false); // Disable verbose internal logs

    // Set cloud role for service map
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] =
      'lockin-backend';

    appInsights.start();
    appInsightsClient = appInsights.defaultClient;
    appInsightsInitialized = true;

    console.log('[AppInsights] Initialized successfully');
    return true;
  } catch (error) {
    // Application Insights v3 with OpenTelemetry can throw if already started
    // This is expected during hot-reload scenarios
    if (error.message?.includes('MeterProvider') || error.message?.includes('already')) {
      console.log('[AppInsights] Skipping re-initialization (hot-reload detected)');
      appInsightsInitialized = true;
      return false;
    }
    console.error('[AppInsights] Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Gracefully dispose of Application Insights.
 * Call this during graceful shutdown to flush telemetry and clean up resources.
 * Uses a guard to prevent multiple shutdown calls (which cause MeterProvider warnings).
 *
 * @returns {Promise<void>}
 */
async function disposeApplicationInsights() {
  // Guard against multiple shutdown calls
  if (isShuttingDown || !appInsightsClient) {
    return;
  }

  isShuttingDown = true;

  try {
    // Flush any pending telemetry before shutdown
    await new Promise((resolve) => {
      appInsightsClient.flush({
        callback: () => {
          console.log('[AppInsights] Telemetry flushed');
          resolve();
        },
      });

      // Timeout fallback in case flush hangs
      setTimeout(resolve, 5000);
    });

    // Dispose the SDK (this internally calls OpenTelemetry shutdown)
    appInsights.dispose();
    console.log('[AppInsights] Disposed successfully');
  } catch (error) {
    // Swallow shutdown errors - these are expected during nodemon restarts
    if (!error.message?.includes('MeterProvider')) {
      console.error('[AppInsights] Error during dispose:', error.message);
    }
  }
}

/**
 * Get the Application Insights client for custom telemetry.
 * Returns null if App Insights is not configured.
 */
function getAppInsightsClient() {
  return appInsightsClient;
}

/**
 * Track a custom metric in Application Insights.
 * Use for business metrics like token usage, request counts, etc.
 *
 * @param {string} name - Metric name (e.g., 'llm.tokens.prompt')
 * @param {number} value - Metric value
 * @param {Object} properties - Additional dimensions/properties
 */
function trackMetric(name, value, properties = {}) {
  if (!appInsightsClient) return;

  appInsightsClient.trackMetric({
    name,
    value,
    properties,
  });
}

/**
 * Track a custom event in Application Insights.
 * Use for significant business events like chat completion, note creation, etc.
 *
 * @param {string} name - Event name (e.g., 'chat.completion')
 * @param {Object} properties - Event properties
 * @param {Object} measurements - Numeric measurements
 */
function trackEvent(name, properties = {}, measurements = {}) {
  if (!appInsightsClient) return;

  appInsightsClient.trackEvent({
    name,
    properties,
    measurements,
  });
}

// =============================================================================
// Pino Structured Logger
// =============================================================================

/**
 * Create the base pino logger instance.
 * Configures JSON output for production, pretty output for development.
 */
function createConsoleLogger() {
  return {
    level: LOG_LEVEL,
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    child: () => createConsoleLogger(),
  };
}

const logger = pino
  ? pino({
      level: LOG_LEVEL,
      // Base fields included in every log entry
      base: {
        service: 'lockin-backend',
        env: process.env.NODE_ENV || 'development',
      },
      // Timestamp configuration
      timestamp: pino.stdTimeFunctions.isoTime,
      // Format options
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          host: bindings.hostname,
        }),
      },
      // In development, use pretty printing
      transport: IS_PRODUCTION
        ? undefined
        : {
            target: 'pino/file',
            options: { destination: 1 }, // stdout
          },
    })
  : createConsoleLogger();

/**
 * Create a child logger with additional context (e.g., request ID, user ID).
 *
 * @param {Object} bindings - Context to add to all log entries
 * @returns {pino.Logger} Child logger instance
 */
function createChildLogger(bindings) {
  return logger.child(bindings);
}

// =============================================================================
// LLM Token Usage Tracking
// =============================================================================

/**
 * Track LLM API usage for cost monitoring and optimization.
 *
 * @param {Object} options
 * @param {string} options.provider - 'azure' or 'openai'
 * @param {string} options.operation - 'chat', 'embeddings', 'transcription'
 * @param {string} options.model - Model/deployment name
 * @param {number} options.promptTokens - Number of prompt tokens
 * @param {number} options.completionTokens - Number of completion tokens
 * @param {number} options.totalTokens - Total tokens used
 * @param {string} [options.userId] - User ID for per-user cost tracking
 * @param {string} [options.requestId] - Request correlation ID
 * @param {number} [options.latencyMs] - Request latency in milliseconds
 */
function trackLlmUsage(options) {
  const {
    provider,
    operation,
    model,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    userId,
    requestId,
    latencyMs,
  } = options;

  // Log token usage with structured logger
  logger.info(
    {
      type: 'llm_usage',
      provider,
      operation,
      model,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens,
      },
      userId,
      requestId,
      latencyMs,
    },
    `LLM ${operation}: ${totalTokens} tokens (${provider}/${model})`,
  );

  // Track in Application Insights
  if (appInsightsClient) {
    trackMetric('llm.tokens.prompt', promptTokens, { provider, operation, model });
    trackMetric('llm.tokens.completion', completionTokens, { provider, operation, model });
    trackMetric('llm.tokens.total', totalTokens, { provider, operation, model });

    if (latencyMs !== undefined) {
      trackMetric('llm.latency.ms', latencyMs, { provider, operation, model });
    }

    trackEvent(
      'llm.request',
      {
        provider,
        operation,
        model,
        userId: userId || 'anonymous',
        requestId,
      },
      {
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: latencyMs || 0,
      },
    );
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  // Application Insights
  initApplicationInsights,
  disposeApplicationInsights,
  getAppInsightsClient,
  trackMetric,
  trackEvent,

  // Pino logger
  logger,
  createChildLogger,

  // LLM tracking
  trackLlmUsage,

  // Constants
  LOG_LEVEL,
};
