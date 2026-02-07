/**
 * Express application bootstrap for the Lock-in backend.
 *
 * This module wires middleware and routes together but does not start the
 * HTTP server itself. That makes it easy to import into tests.
 */

const express = require('express');
const cors = require('cors');
const { MAX_SELECTION_LENGTH, MAX_USER_MESSAGE_LENGTH, isOriginAllowed } = require('./config');
const assistantRoutes = require('./routes/assistantRoutes');
const noteRoutes = require('./routes/noteRoutes');
const transcriptsRoutes = require('./routes/transcriptsRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
// const healthRoutes = require('./routes/healthRoutes'); // TODO: Fix and re-enable
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { setupSentryErrorHandler } = require('./observability/sentry');
const { createRequestLogger, sentryRequestIdMiddleware } = require('./observability/requestLogger');
const { createHealthRoutes } = require('./observability/healthCheck');
const { supabase } = require('./db/supabaseClient');
const config = require('./config');

function createApp() {
  const app = express();

  // Note: Sentry is initialized in index.js before any imports
  // Only the error handler setup is needed here (after routes are defined)

  // Core middleware
  app.use(express.json());

  // Request ID and structured logging (must be early in middleware chain)
  app.use(sentryRequestIdMiddleware);
  app.use(createRequestLogger());

  // CORS configuration – allow Chrome extensions and localhost by default.
  app.use(
    cors({
      origin(origin, callback) {
        const allowed = isOriginAllowed(origin);
        if (allowed) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    }),
  );

  // Health check endpoints (before auth middleware)
  const healthRoutes = createHealthRoutes({
    supabase,
    config,
    limits: {
      maxSelectionLength: MAX_SELECTION_LENGTH,
      maxUserMessageLength: MAX_USER_MESSAGE_LENGTH,
    },
  });

  app.get('/health', healthRoutes.liveness);
  app.get('/health/ready', healthRoutes.readiness);
  app.get('/health/deep', healthRoutes.deep);

  // Circuit breaker status endpoint (public, no auth required for observability)
  const {
    getCircuitBreakerStatus,
    resetCircuitBreaker,
  } = require('./controllers/health/circuitBreaker');
  const { requireSupabaseUser } = require('./middleware/authMiddleware');

  app.get('/health/circuit-breaker', getCircuitBreakerStatus);
  // Reset requires authentication (admin operation)
  app.post('/health/circuit-breaker/reset', requireSupabaseUser, resetCircuitBreaker);

  // Sentry test endpoint (only in development)
  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug-sentry', (_req, _res, _next) => {
      // This will throw an error that Sentry should capture
      throw new Error('Sentry test error from Lock-in backend!');
    });
  }

  // API routes
  app.use('/api', assistantRoutes);
  app.use('/api', noteRoutes);
  app.use('/api', transcriptsRoutes);
  app.use('/api', feedbackRoutes);
  // app.use('/api/health/embeddings', healthRoutes); // TODO: Fix and re-enable

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Sentry error handler (captures errors to Sentry before your handler)
  // Must be after routes but before custom error handler
  setupSentryErrorHandler(app);

  // Centralized error handler middleware (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
