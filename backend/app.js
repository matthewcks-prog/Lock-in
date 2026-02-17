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
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { setupSentryErrorHandler } = require('./observability/sentry');
const { createRequestLogger, sentryRequestIdMiddleware } = require('./observability/requestLogger');
const { createHealthRoutes } = require('./observability/healthCheck');
const { supabase } = require('./db/supabaseClient');
const config = require('./config');
const {
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} = require('./controllers/health/circuitBreaker');
const { requireSupabaseUser } = require('./middleware/authMiddleware');

function configureCors(app) {
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
}

function registerHealthRoutes(app, healthRoutes) {
  app.get('/health', healthRoutes.liveness);
  app.get('/health/ready', healthRoutes.readiness);
  app.get('/health/deep', healthRoutes.deep);
}

function registerCircuitBreakerRoutes(app) {
  app.get('/health/circuit-breaker', getCircuitBreakerStatus);
  app.post('/health/circuit-breaker/reset', requireSupabaseUser, resetCircuitBreaker);
}

function registerDebugSentryRoute(app) {
  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug-sentry', (_req, _res, _next) => {
      throw new Error('Sentry test error from Lock-in backend!');
    });
  }
}

function registerApiRoutes(app) {
  app.use('/api', assistantRoutes);
  app.use('/api', noteRoutes);
  app.use('/api', transcriptsRoutes);
  app.use('/api', feedbackRoutes);
}

function registerErrorHandlers(app) {
  app.use(notFoundHandler);
  setupSentryErrorHandler(app);
  app.use(errorHandler);
}

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(sentryRequestIdMiddleware);
  app.use(createRequestLogger());
  configureCors(app);

  const healthRoutes = createHealthRoutes({
    supabase,
    config,
    limits: {
      maxSelectionLength: MAX_SELECTION_LENGTH,
      maxUserMessageLength: MAX_USER_MESSAGE_LENGTH,
    },
  });

  registerHealthRoutes(app, healthRoutes);
  registerCircuitBreakerRoutes(app);
  registerDebugSentryRoute(app);
  registerApiRoutes(app);
  registerErrorHandlers(app);

  return app;
}

module.exports = {
  createApp,
};
