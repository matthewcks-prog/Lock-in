export type TranscriptLogLevel = 'debug' | 'info' | 'warn' | 'error';

type TranscriptLogSetting = TranscriptLogLevel | 'silent';

const SENSITIVE_META_KEY_PATTERN =
  /transcript|note|selection|prompt|message|content|chat|caption|text|query|input|output|body|chunk|sample|html/i;
const URL_KEY_PATTERN = /url|uri|href|link/i;
const URL_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s)]+/gi;
const MAX_STRING_LENGTH = 300;
const MAX_META_DEPTH = 4;

const LOG_LEVELS: Record<TranscriptLogSetting, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function isTestEnv(): boolean {
  if (typeof process === 'undefined') return false;
  const env = process.env ?? {};
  return env['NODE_ENV'] === 'test' || env['VITEST'] === 'true' || env['VITEST'] === '1';
}

function resolveLogLevel(): TranscriptLogSetting {
  if (typeof process !== 'undefined') {
    const raw = process.env?.['LOCKIN_TRANSCRIPT_LOG_LEVEL'];
    if (typeof raw === 'string' && raw.length > 0) {
      const normalized = raw.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, normalized)) {
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

type ConsoleFn = (...args: unknown[]) => void;

function getConsoleFn(level: TranscriptLogLevel): ConsoleFn {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  if (level === 'info') return console.info ?? console.log;
  return console.debug ?? console.log;
}

function stripQueryAndHashFromUrl(value: string): string {
  if (value.length === 0) return value;
  try {
    const parsed = new URL(value, 'http://placeholder.local');
    parsed.search = '';
    parsed.hash = '';
    if (URL_PROTOCOL_PATTERN.test(value)) {
      return parsed.toString().replace(/\/$/, '');
    }
    return parsed.pathname;
  } catch {
    const withoutQuery = value.split('?')[0] ?? value;
    return (withoutQuery.split('#')[0] ?? withoutQuery).trim();
  }
}

function sanitizeInlineUrls(value: string): string {
  if (!value.includes('http://') && !value.includes('https://')) {
    return value;
  }
  return value.replace(URL_IN_TEXT_PATTERN, (url) => stripQueryAndHashFromUrl(url));
}

function sanitizeString(value: string, key?: string): string {
  if (typeof key === 'string' && SENSITIVE_META_KEY_PATTERN.test(key)) {
    return `[REDACTED:${value.length}]`;
  }
  if (typeof key === 'string' && URL_KEY_PATTERN.test(key)) {
    return stripQueryAndHashFromUrl(value);
  }
  if (URL_PROTOCOL_PATTERN.test(value)) {
    return stripQueryAndHashFromUrl(value);
  }
  if (value.includes('http://') || value.includes('https://')) {
    return sanitizeInlineUrls(value);
  }
  if (value.length > MAX_STRING_LENGTH) {
    return `[REDACTED_LONG_STRING:${value.length}]`;
  }
  return value;
}

function sanitizeError(error: Error): Record<string, unknown> {
  const err = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
  return {
    name: err.name,
    message: sanitizeInlineUrls(err.message),
    code: err.code,
    status: err.status ?? err.statusCode,
  };
}

function sanitizeMetaValue(
  value: unknown,
  key?: string,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value, key);
  if (typeof value !== 'object') return value;
  if (value instanceof Error) return sanitizeError(value);
  if (seen.has(value)) return '[Circular]';
  if (depth >= MAX_META_DEPTH) return '[Truncated]';

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetaValue(item, key, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (SENSITIVE_META_KEY_PATTERN.test(entryKey)) {
      output[entryKey] = '[REDACTED]';
      continue;
    }
    output[entryKey] = sanitizeMetaValue(entryValue, entryKey, depth + 1, seen);
  }
  return output;
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return sanitizeMetaValue(meta) as Record<string, unknown>;
}

export function logWithPrefix(
  prefix: string,
  level: TranscriptLogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const logFn = getConsoleFn(level);
  const safeMessage = sanitizeInlineUrls(message);
  const formatted = prefix.length > 0 ? `${prefix} ${safeMessage}` : safeMessage;
  if (meta !== undefined) {
    logFn(formatted, sanitizeMeta(meta));
  } else {
    logFn(formatted);
  }
}
