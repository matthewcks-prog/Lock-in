(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  const SENSITIVE_KEY_PATTERN =
    /transcript|note|selection|prompt|message|content|chat|caption|text|query|input|output|body|chunk/i;
  const URL_KEY_PATTERN = /url|uri|href|link/i;
  const URL_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
  const MAX_STRING_LENGTH = 300;
  const MAX_DEPTH = 4;

  function stripQueryAndHash(value) {
    if (!value || typeof value !== 'string') return value;
    try {
      const parsed = new URL(value, 'http://placeholder.local');
      parsed.search = '';
      parsed.hash = '';
      if (URL_PROTOCOL_PATTERN.test(value)) {
        return parsed.toString().replace(/\/$/, '');
      }
      return parsed.pathname;
    } catch {
      const withoutQuery = value.split('?')[0] || value;
      return withoutQuery.split('#')[0] || withoutQuery;
    }
  }

  function sanitizeError(error) {
    return {
      name: error?.name || 'Error',
      message: stripQueryAndHash(String(error?.message || error)),
      code: error?.code,
      status: error?.status ?? error?.statusCode,
    };
  }

  function sanitizeString(value, key) {
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

  function sanitizeValue(value, key, depth = 0, seen = new WeakSet()) {
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
    if (depth >= MAX_DEPTH) {
      return '[Truncated]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, key, depth + 1, seen));
    }

    const output = {};
    Object.entries(value).forEach(([entryKey, entryValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(entryKey)) {
        output[entryKey] = '[REDACTED]';
        return;
      }
      output[entryKey] = sanitizeValue(entryValue, entryKey, depth + 1, seen);
    });
    return output;
  }

  function sanitizeArgs(args) {
    return args.map((arg) => sanitizeValue(arg));
  }

  function createLogger(options = {}) {
    const prefix = options.prefix || '[Lock-in BG]';
    const debugEnabled = options.debugEnabled !== false;
    const silent = options.silent === true;

    const format = (args) => [prefix, ...sanitizeArgs(args)];

    return {
      debug: (...args) => {
        if (silent || !debugEnabled) return;
        (console.debug || console.log)(...format(args));
      },
      info: (...args) => {
        if (silent) return;
        (console.info || console.log)(...format(args));
      },
      warn: (...args) => {
        if (silent) return;
        console.warn(...format(args));
      },
      error: (...args) => {
        if (silent) return;
        console.error(...format(args));
      },
      withPrefix: (suffix) =>
        createLogger({
          prefix: `${prefix} ${suffix}`,
          debugEnabled,
          silent,
        }),
    };
  }

  registry.logging = {
    createLogger,
  };
})();
