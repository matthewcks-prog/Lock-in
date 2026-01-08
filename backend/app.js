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
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Core middleware
  app.use(express.json());

  // CORS configuration – allow Chrome extensions and localhost by default.
  app.use(
    cors({
      origin(origin, callback) {
        // #region agent log
        const fs = require('fs');
        const logPath = 'c:\\Users\\matth\\Lock-in\\.cursor\\debug.log';
        try {
          const logEntry =
            JSON.stringify({
              location: 'app.js:29',
              message: 'CORS origin check',
              data: { origin, method: 'CORS middleware', requestType: 'preflight or actual' },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'B2',
            }) + '\n';
          fs.appendFileSync(logPath, logEntry, 'utf8');
        } catch (e) {}
        // #endregion
        const allowed = isOriginAllowed(origin);
        // #region agent log
        try {
          const logEntry =
            JSON.stringify({
              location: 'app.js:31',
              message: 'CORS callback decision',
              data: { origin, allowed, willAllow: allowed },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'B2',
            }) + '\n';
          fs.appendFileSync(logPath, logEntry, 'utf8');
        } catch (e) {}
        // #endregion
        if (allowed) {
          callback(null, true);
        } else {
          // In production you may want to reject here instead of allowing.
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

  // API routes
  app.use('/api', lockinRoutes);
  app.use('/api', noteRoutes);
  app.use('/api', transcriptsRoutes);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized error handler middleware (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
