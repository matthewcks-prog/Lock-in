export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface LoggerOptions {
  configProvider?: () => Record<string, unknown> | undefined;
  console?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getDefaultConfig(): Record<string, unknown> | undefined {
  return (globalThis as { LOCKIN_CONFIG?: Record<string, unknown> }).LOCKIN_CONFIG;
}

function resolveLogLevel(configProvider?: LoggerOptions['configProvider']): LogLevel {
  const config = (configProvider || getDefaultConfig)();
  const level = typeof config?.LOG_LEVEL === 'string' ? config.LOG_LEVEL.toLowerCase() : null;
  const debug = config?.DEBUG === true || config?.DEBUG === 'true';

  if (level && (level === 'debug' || level === 'info' || level === 'warn' || level === 'error')) {
    return level;
  }

  return debug ? 'debug' : 'info';
}

function isEnabled(level: LogLevel, configProvider?: LoggerOptions['configProvider']): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[resolveLogLevel(configProvider)];
}

export function createLogger(scope?: string, options: LoggerOptions = {}): Logger {
  const prefix = scope ? `[Lock-in:${scope}]` : '[Lock-in]';
  const configProvider = options.configProvider;
  const consoleRef = options.console ?? console;

  return {
    debug(...args: unknown[]) {
      if (isEnabled('debug', configProvider)) {
        consoleRef.debug(prefix, ...args);
      }
    },
    info(...args: unknown[]) {
      if (isEnabled('info', configProvider)) {
        consoleRef.info(prefix, ...args);
      }
    },
    warn(...args: unknown[]) {
      if (isEnabled('warn', configProvider)) {
        consoleRef.warn(prefix, ...args);
      }
    },
    error(...args: unknown[]) {
      if (isEnabled('error', configProvider)) {
        consoleRef.error(prefix, ...args);
      }
    },
  };
}

export const logger = createLogger();
