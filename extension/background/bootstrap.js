(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function safeImportScripts(label, scripts) {
    if (!Array.isArray(scripts) || scripts.length === 0) return false;
    try {
      importScripts(...scripts);
      return true;
    } catch (error) {
      console.warn(`Lock-in: Failed to import ${label}:`, error);
      return false;
    }
  }

  function loadSharedScripts() {
    safeImportScripts('transcriptProviders.js', ['dist/libs/transcriptProviders.js']);
    safeImportScripts('networkRetry.js', ['src/networkRetry.js']);
    safeImportScripts('networkUtils.js', ['src/networkUtils.js']);
    safeImportScripts('panoptoResolver.js', [
      'src/panoptoResolverHelpers.js',
      'src/panoptoResolverRuntime.js',
      'src/panoptoResolverNetwork.js',
      'src/panoptoResolver.js',
    ]);
  }

  function loadBackgroundModules() {
    safeImportScripts('background modules', [
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
      'background/transcripts/aiTranscriptionHelpers.js',
      'background/transcripts/aiTranscriptionRequests.js',
      'background/transcripts/aiTranscription.js',
      'background/handlers/sessionHandlers.js',
      'background/handlers/settingsHandlers.js',
      'background/handlers/transcriptHandlers.js',
      'background/handlers/aiTranscriptionHandlers.js',
      'background/contextMenus.js',
      'background/lifecycle.js',
      'background/index.js',
    ]);
  }

  function loadAll() {
    loadSharedScripts();
    loadBackgroundModules();
  }

  registry.bootstrap = {
    loadSharedScripts,
    loadBackgroundModules,
    loadAll,
  };
})();
