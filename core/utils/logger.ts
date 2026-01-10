export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const config = (globalThis as { LOCKIN_CONFIG?: Record<string, unknown> }).LOCKIN_CONFIG;
  const level = typeof config?.LOG_LEVEL === 'string' ? config.LOG_LEVEL.toLowerCase() : null;
  const debug = config?.DEBUG === true || config?.DEBUG === 'true';

  if (level && (level === 'debug' || level === 'info' || level === 'warn' || level === 'error')) {
    return level;
  }

  return debug ? 'debug' : 'info';
}

function isEnabled(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[resolveLogLevel()];
}

export function createLogger(scope?: string): Logger {
  const prefix = scope ? `[Lock-in:${scope}]` : '[Lock-in]';

  return {
    debug(...args: unknown[]) {
      if (isEnabled('debug')) {
        console.debug(prefix, ...args);
      }
    },
    info(...args: unknown[]) {
      if (isEnabled('info')) {
        console.info(prefix, ...args);
      }
    },
    warn(...args: unknown[]) {
      if (isEnabled('warn')) {
        console.warn(prefix, ...args);
      }
    },
    error(...args: unknown[]) {
      if (isEnabled('error')) {
        console.error(prefix, ...args);
      }
    },
  };
}

export const logger = createLogger();
