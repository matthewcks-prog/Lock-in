export type TranscriptLogLevel = 'debug' | 'info' | 'warn' | 'error';

type TranscriptLogSetting = TranscriptLogLevel | 'silent';

const LOG_LEVELS: Record<TranscriptLogSetting, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function isTestEnv(): boolean {
  if (typeof process === 'undefined') return false;
  const env = process.env || {};
  return env['NODE_ENV'] === 'test' || env['VITEST'] === 'true' || env['VITEST'] === '1';
}

function resolveLogLevel(): TranscriptLogSetting {
  if (typeof process !== 'undefined') {
    const raw = process.env?.['LOCKIN_TRANSCRIPT_LOG_LEVEL'];
    if (raw) {
      const normalized = raw.toLowerCase();
      if (normalized in LOG_LEVELS) {
        return normalized as TranscriptLogSetting;
      }
    }
  }

  if (isTestEnv()) {
    return 'silent';
  }

  return 'warn';
}

const resolvedLogLevel = resolveLogLevel();
const resolvedLogLevelValue = LOG_LEVELS[resolvedLogLevel];

function shouldLog(level: TranscriptLogLevel): boolean {
  return LOG_LEVELS[level] >= resolvedLogLevelValue;
}

function getConsoleFn(level: TranscriptLogLevel) {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  if (level === 'info') return console.info || console.log;
  return console.debug || console.log;
}

export function logWithPrefix(
  prefix: string,
  level: TranscriptLogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const logFn = getConsoleFn(level);
  const formatted = prefix ? `${prefix} ${message}` : message;
  if (meta) {
    logFn(formatted, meta);
  } else {
    logFn(formatted);
  }
}
