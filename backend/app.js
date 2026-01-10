/**
 * Express application bootstrap for the Lock-in backend.
 *
 * This module wires middleware and routes together but does not start the
 * HTTP server itself. That makes it easy to import into tests.
 */

const express = require('express');
const cors = require('cors');
const { MAX_SELECTION_LENGTH, MAX_USER_MESSAGE_LENGTH, isOriginAllowed } = require('./config');
const lockinRoutes = require('./routes/lockinRoutes');
const noteRoutes = require('./routes/noteRoutes');
const transcriptsRoutes = require('./routes/transcriptsRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { setupSentryErrorHandler } = require('./sentry');

function createApp() {
  const app = express();

  // Note: Sentry is initialized in index.js before any imports
  // Only the error handler setup is needed here (after routes are defined)

  // Core middleware
  app.use(express.json());

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

  // Lightweight structured request logging
  app.use((req, res, next) => {
    const body = req.body || {};
    const selection = body.selection || body.text;
    const chatLength = Array.isArray(body.chatHistory) ? body.chatHistory.length : 0;

    if (selection || chatLength) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} - Mode: ${
          body.mode || 'n/a'
        }, Selection length: ${selection ? selection.length : 0}, Chat messages: ${chatLength}`,
      );
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Lock-in API is running',
      limits: {
        maxSelectionLength: MAX_SELECTION_LENGTH,
        maxUserMessageLength: MAX_USER_MESSAGE_LENGTH,
      },
    });
  });

  // Sentry test endpoint (only in development)
  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug-sentry', (req, res, next) => {
      // This will throw an error that Sentry should capture
      throw new Error('Sentry test error from Lock-in backend!');
    });
  }

  // API routes
  app.use('/api', lockinRoutes);
  app.use('/api', noteRoutes);
  app.use('/api', transcriptsRoutes);
  app.use('/api', feedbackRoutes);

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
