/**
 * Logger for Extension Content Scripts
 * 
 * Provides structured logging with levels and consistent formatting.
 * Exposes window.LockInLogger for use by content scripts.
 * 
 * This is bundled by vite.config.contentLibs.ts into extension/libs/
 */

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Configuration for logger
 * Can be controlled via window.LOCKIN_CONFIG.DEBUG
 */
function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const config = (window as any).LOCKIN_CONFIG;
  return config?.DEBUG === true || config?.DEBUG === "true";
}

/**
 * Create the logger instance
 */
function createLogger(): Logger {
  const PREFIX = "[Lock-in]";

  return {
    debug(...args: unknown[]) {
      if (isDebugEnabled()) {
        console.debug(PREFIX, ...args);
      }
    },

    info(...args: unknown[]) {
      console.info(PREFIX, ...args);
    },

    warn(...args: unknown[]) {
      console.warn(PREFIX, ...args);
    },

    error(...args: unknown[]) {
      console.error(PREFIX, ...args);
    },
  };
}

// Create and expose the logger
const logger = createLogger();

// Expose globally for content scripts
if (typeof window !== "undefined") {
  (window as any).LockInLogger = logger;
}

export { logger };
