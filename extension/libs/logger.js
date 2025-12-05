/**
 * Logger utility for Lock-in Extension
 * 
 * Provides conditional logging that can be disabled in production.
 */

const IS_DEVELOPMENT = 
  typeof window !== "undefined" && 
  window.LOCKIN_CONFIG && 
  window.LOCKIN_CONFIG.BACKEND_URL && 
  window.LOCKIN_CONFIG.BACKEND_URL.includes("localhost");

/**
 * Log debug messages (only in development)
 */
function debug(...args) {
  if (IS_DEVELOPMENT) {
    console.log("[Lock-in]", ...args);
  }
}

/**
 * Log info messages (only in development)
 */
function info(...args) {
  if (IS_DEVELOPMENT) {
    console.info("[Lock-in]", ...args);
  }
}

/**
 * Log warnings (always shown)
 */
function warn(...args) {
  console.warn("[Lock-in]", ...args);
}

/**
 * Log errors (always shown)
 */
function error(...args) {
  console.error("[Lock-in]", ...args);
}

// Export for use in extension
if (typeof window !== "undefined") {
  window.LockInLogger = {
    debug,
    info,
    warn,
    error,
    IS_DEVELOPMENT,
  };
}

// Export for Node.js/CommonJS if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    debug,
    info,
    warn,
    error,
    IS_DEVELOPMENT,
  };
}

