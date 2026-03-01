/**
 * Lock-in Background Service Worker (entrypoint)
 *
 * Loads shared libs, registers background modules, and wires listeners.
 * All operational side effects are triggered via initBackground().
 */

// ============================================================================
// Import shared libraries
// ============================================================================

// Config must be first (sets up LOCKIN_CONFIG)
try {
  importScripts('config.js');
} catch (e) {
  console.warn('Lock-in: Failed to import config.js:', e);
}

// Sentry error tracking (must be early, after config)
try {
  importScripts('dist/libs/sentry.js');
  if (typeof self !== 'undefined' && self.LockInSentry) {
    self.LockInSentry.initSentry('background');
    self.LockInSentry.setupMv3Lifecycle();
  }
} catch (e) {
  console.warn('Lock-in: Failed to import/init sentry.js:', e);
}

// Load background bootstrap (shared libs + modules)
try {
  importScripts('background/bootstrap.js');
  if (self.LockInBackground?.bootstrap?.loadAll) {
    self.LockInBackground.bootstrap.loadAll();
  } else {
    console.error('Lock-in: Background bootstrap unavailable.');
  }
} catch (e) {
  console.error('Lock-in: Failed to import background bootstrap:', e);
}

// ============================================================================
// Initialize background app
// ============================================================================

const Messaging = typeof self !== 'undefined' && self.LockInMessaging ? self.LockInMessaging : null;
const TranscriptProviders =
  typeof self !== 'undefined' && self.LockInTranscriptProviders
    ? self.LockInTranscriptProviders
    : null;
const NetworkUtils =
  typeof self !== 'undefined' && self.LockInNetworkUtils ? self.LockInNetworkUtils : null;
const PanoptoResolver =
  typeof self !== 'undefined' && self.LockInPanoptoResolver ? self.LockInPanoptoResolver : null;

if (self.LockInBackground?.index?.initBackground) {
  self.LockInBackground.index.initBackground({
    chrome,
    messaging: Messaging,
    transcriptProviders: TranscriptProviders,
    networkUtils: NetworkUtils,
    panoptoResolver: PanoptoResolver,
    lockinConfig: self.LOCKIN_CONFIG,
  });
} else {
  console.error('Lock-in: Background init unavailable.');
}
