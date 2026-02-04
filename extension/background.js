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

// Other shared libraries
try {
  importScripts('dist/libs/transcriptProviders.js');
} catch (e) {
  console.warn('Lock-in: Failed to import transcriptProviders.js:', e);
}
try {
  importScripts('src/networkUtils.js');
} catch (e) {
  console.warn('Lock-in: Failed to import networkUtils.js:', e);
}
try {
  importScripts(
    'src/panoptoResolverHelpers.js',
    'src/panoptoResolverRuntime.js',
    'src/panoptoResolverNetwork.js',
    'src/panoptoResolver.js',
  );
} catch (e) {
  console.warn('Lock-in: Failed to import panoptoResolver.js:', e);
}

// ============================================================================
// Load background modules (no listeners/registering side effects)
// ============================================================================

try {
  importScripts(
    'background/logging.js',
    'background/errors.js',
    'background/config.js',
    'background/chromeClient.js',
    'background/responder.js',
    'background/validators.js',
    'background/router.js',
    'background/sessions/sessionStore.js',
    'background/settings/settingsStore.js',
    'background/auth/authService.js',
    'background/transcripts/registry.js',
    'background/transcripts/extensionFetcher.js',
    'background/transcripts/extraction.js',
    'background/transcripts/panoptoMedia.js',
    'background/transcripts/aiUtils.js',
    'background/transcripts/contentScriptMedia.js',
    'background/transcripts/aiTranscriptionUpload.js',
    'background/transcripts/aiTranscriptionPolling.js',
    'background/transcripts/aiTranscription.js',
    'background/handlers/sessionHandlers.js',
    'background/handlers/settingsHandlers.js',
    'background/handlers/transcriptHandlers.js',
    'background/handlers/aiTranscriptionHandlers.js',
    'background/contextMenus.js',
    'background/lifecycle.js',
    'background/index.js',
  );
} catch (e) {
  console.error('Lock-in: Failed to import background modules:', e);
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
