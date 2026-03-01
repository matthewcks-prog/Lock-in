const { createConsoleLogger } = require('./consoleLoggerFallback');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');

let pino = null;
try {
  // Use Node resolution so workspaces/hoisting still locate the dependency.
  pino = require('pino');
} catch (error) {
  if (!IS_PRODUCTION) {
    console.warn(
      '[Observability] Pino not available; using console logger fallback.',
      error?.message,
    );
  }
}

const logger = pino
  ? pino({
      level: LOG_LEVEL,
      base: {
        service: 'lockin-backend',
        env: process.env.NODE_ENV || 'development',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          host: bindings.hostname,
        }),
      },
      transport: IS_PRODUCTION
        ? undefined
        : {
            target: 'pino/file',
            options: { destination: 1 },
          },
    })
  : createConsoleLogger(LOG_LEVEL);

function createChildLogger(bindings) {
  return logger.child(bindings);
}

module.exports = {
  IS_PRODUCTION,
  LOG_LEVEL,
  logger,
  createChildLogger,
};
