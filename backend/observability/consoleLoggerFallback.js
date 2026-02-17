const DEFAULT_PINO_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

function createConsoleLogger(logLevel) {
  return {
    level: logLevel,
    levels: { values: DEFAULT_PINO_LEVELS },
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    trace: console.debug.bind(console),
    fatal: console.error.bind(console),
    child: () => createConsoleLogger(logLevel),
  };
}

module.exports = {
  createConsoleLogger,
  DEFAULT_PINO_LEVELS,
};
