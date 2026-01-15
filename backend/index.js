/**
 * Lock-in Backend Server
 * Express API that handles AI-powered text processing for the Chrome extension.
 *
 * This file is now a thin bootstrap that wires configuration + the Express app
 * and starts the HTTP server. All request handling lives in the app/routes/
 * and controllers/ folders to keep things testable and maintainable.
 */

// IMPORTANT: Load environment variables first, then initialize Sentry
// BEFORE any other imports. This ensures Sentry can instrument all modules.
require('dotenv').config();
const { initSentry } = require('./sentry');
initSentry();

// Now import everything else - Sentry will automatically instrument these
const { createApp } = require('./app');
const { PORT } = require('./config');
const { startTranscriptJobReaper, stopTranscriptJobReaper } = require('./services/transcriptsService');

// =============================================================================
// Production Environment Validation
// =============================================================================
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Fail fast on missing critical environment variables in production
  const requiredEnvVars = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
}

// =============================================================================
// Structured Logging for Production
// =============================================================================
const log = (level, message, meta = {}) => {
  if (isProduction) {
    // JSON format for Azure Monitor ingestion
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    }));
  } else {
    // Human-readable format for development
    console.log(`[${level.toUpperCase()}] ${message}`, Object.keys(meta).length ? meta : '');
  }
};

// =============================================================================
// Application Startup
// =============================================================================
const app = createApp();

const server = app.listen(PORT, () => {
  log('info', `Lock-in backend server running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  log('info', 'Ready to help students learn!');

  if (!process.env.OPENAI_API_KEY) {
    log('warn', 'OPENAI_API_KEY not found in environment variables');
  }

  startTranscriptJobReaper();
});

// =============================================================================
// Graceful Shutdown Handlers
// Ensures clean container termination in Azure Container Apps
// =============================================================================
const gracefulShutdown = (signal) => {
  log('info', `${signal} received, starting graceful shutdown...`, { signal });
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      log('error', 'Error during server close', { error: err.message });
      process.exit(1);
    }
    
    log('info', 'HTTP server closed');
    
    // Stop background jobs
    stopTranscriptJobReaper();
    log('info', 'Transcript job reaper stopped');
    
    log('info', 'Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    log('error', 'Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', { reason: String(reason) });
});
