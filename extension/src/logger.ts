/**
 * Logger for Extension Content Scripts
 *
 * Provides structured logging with levels and consistent formatting.
 * Exposes window.LockInLogger for use by content scripts.
 *
 * This is bundled by vite.config.contentLibs.ts into extension/dist/libs/
 */

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const SENSITIVE_KEY_PATTERN =
  /transcript|note|selection|prompt|message|content|chat|caption|text|query|input|output|body|chunk/i;
const URL_KEY_PATTERN = /url|uri|href|link/i;
const URL_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const MAX_STRING_LENGTH = 300;
const MAX_OBJECT_DEPTH = 4;

function stripQueryAndHash(value: string): string {
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
    return withoutQuery.split('#')[0] ?? withoutQuery;
  }
}

function sanitizeError(error: Error): Record<string, unknown> {
  const raw = error as Error & {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return {
    name: raw.name,
    message: stripQueryAndHash(raw.message),
    code: raw.code,
    status: raw.status ?? raw.statusCode,
  };
}

function sanitizeString(value: string, key?: string): string {
  if (typeof key === 'string' && SENSITIVE_KEY_PATTERN.test(key)) {
    return `[REDACTED:${value.length}]`;
  }
  if (typeof key === 'string' && URL_KEY_PATTERN.test(key)) {
    return stripQueryAndHash(value);
  }
  if (URL_PROTOCOL_PATTERN.test(value)) {
    return stripQueryAndHash(value);
  }
  if (value.length > MAX_STRING_LENGTH) {
    return `[REDACTED_LONG_STRING:${value.length}]`;
  }
  return value;
}

// eslint-disable-next-line max-statements -- Redaction requires explicit guarded branches per value type.
function sanitizeValue(
  value: unknown,
  key?: string,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeString(value, key);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Error) {
    return sanitizeError(value);
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= MAX_OBJECT_DEPTH) {
    return '[Truncated]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(entryKey)) {
      output[entryKey] = '[REDACTED]';
      continue;
    }
    output[entryKey] = sanitizeValue(entryValue, entryKey, depth + 1, seen);
  }
  return output;
}

export function sanitizeForLogging(args: unknown[]): unknown[] {
  return args.map((arg) => sanitizeValue(arg));
}

/**
 * Configuration for logger
 * Can be controlled via window.LOCKIN_CONFIG.DEBUG
 */
function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const config = window.LOCKIN_CONFIG;
  return config?.DEBUG === true || config?.DEBUG === 'true';
}

/**
 * Create the logger instance
 */
function createLogger(): Logger {
  const PREFIX = '[Lock-in]';

  return {
    debug(...args: unknown[]) {
      if (isDebugEnabled()) {
        console.debug(PREFIX, ...sanitizeForLogging(args));
      }
    },

    info(...args: unknown[]) {
      console.info(PREFIX, ...sanitizeForLogging(args));
    },

    warn(...args: unknown[]) {
      console.warn(PREFIX, ...sanitizeForLogging(args));
    },

    error(...args: unknown[]) {
      console.error(PREFIX, ...sanitizeForLogging(args));
    },
  };
}

// Create and expose the logger
const logger = createLogger();

// Expose globally for content scripts
if (typeof window !== 'undefined') {
  window.LockInLogger = logger;
}

export { logger };
