(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createLogger(options = {}) {
    const prefix = options.prefix || '[Lock-in BG]';
    const debugEnabled = options.debugEnabled !== false;
    const silent = options.silent === true;

    const format = (args) => [prefix, ...args];

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
