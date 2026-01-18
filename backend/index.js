/**
 * Lock-in Backend Server
 * Express API that handles AI-powered text processing for the Chrome extension.
 *
 * This file is now a thin bootstrap that wires configuration + the Express app
 * and starts the HTTP server. All request handling lives in the app/routes/
 * and controllers/ folders to keep things testable and maintainable.
 */

// =============================================================================
// CRITICAL: Load order matters!
// 1. Environment variables
// 2. Validation
// 3. Application Insights (must be before other imports to instrument them)
// 4. Sentry
// 5. Everything else
// =============================================================================

// Load environment variables first
require('dotenv').config();

// Validate environment variables (fail fast if misconfigured)
const { validateEnvOrExit, LOCKIN_BACKEND_SCHEMA } = require('./utils/validateEnv');
validateEnvOrExit(LOCKIN_BACKEND_SCHEMA);

// Initialize Application Insights BEFORE other imports (instruments Node modules)
const { initApplicationInsights, logger } = require('./observability');
initApplicationInsights();

// Initialize Sentry after App Insights
const { initSentry } = require('./sentry');
initSentry();

// Now import everything else - both App Insights and Sentry will instrument these
const { createApp } = require('./app');
const {
  PORT,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  isAzureEnabled,
  isOpenAIEnabled,
  isOpenAIFallbackEnabled,
} = require('./config');
const {
  startTranscriptJobReaper,
  stopTranscriptJobReaper,
} = require('./services/transcriptsService');

// =============================================================================
// Application Startup
// =============================================================================
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, `Lock-in backend server running on port ${PORT}`);
  logger.info('Ready to help students learn!');

  if (!isAzureEnabled() && !isOpenAIEnabled()) {
    logger.warn('No LLM credentials found (Azure OpenAI or OpenAI).');
  } else if (isAzureEnabled() && !isOpenAIFallbackEnabled()) {
    logger.warn('Azure OpenAI enabled without OpenAI fallback credentials.');
  }

  startTranscriptJobReaper();
});

// =============================================================================
// Graceful Shutdown Handlers
// Ensures clean container termination in Azure Container Apps
// =============================================================================
const gracefulShutdown = (signal) => {
  logger.info({ signal }, `${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error({ error: err.message }, 'Error during server close');
      process.exit(1);
    }

    logger.info('HTTP server closed');

    // Stop background jobs
    stopTranscriptJobReaper();
    logger.info('Transcript job reaper stopped');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught exception');
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason: String(reason) }, 'Unhandled rejection');
});
