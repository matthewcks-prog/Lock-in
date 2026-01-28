(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createBackgroundApp({
    chrome,
    messaging,
    transcriptProviders,
    networkUtils,
    panoptoResolver,
    lockinConfig,
  }) {
    const log = registry.logging.createLogger({ prefix: '[Lock-in BG]' });
    const chromeClient = registry.chromeClient.createChromeClient(chrome);
    const config = registry.config.createConfig(lockinConfig);
    const respond = registry.responder.createResponder(messaging);
    const transcriptsLog = log.withPrefix('[Transcripts]');

    const sessionStore = registry.sessions.createSessionStore({ chromeClient, log });
    const settingsStore = registry.settings.createSettingsStore({ chromeClient, log });
    const authService = registry.auth.createAuthService({ chromeClient, config, log });

    const transcriptRegistry = registry.transcripts.registry.createTranscriptRegistry({
      transcriptProviders,
      log: transcriptsLog,
    });
    const createExtensionFetcher =
      registry.transcripts.extensionFetcher.createExtensionFetcherFactory({
        networkUtils,
        transcriptProviders,
      });
    const transcriptExtraction = registry.transcripts.extraction.createTranscriptExtractionService({
      transcriptProviders,
      transcriptRegistry,
      createExtensionFetcher,
      log: transcriptsLog,
    });
    const panoptoMedia = registry.transcripts.panoptoMedia.createPanoptoMediaService({
      transcriptProviders,
      panoptoResolver,
      createExtensionFetcher,
      log: transcriptsLog,
    });
    const contentScriptMedia =
      registry.transcripts.contentScriptMedia.createContentScriptMediaService({
        chromeClient,
        errors: registry.errors,
        log: transcriptsLog,
      });
    const aiTranscription = registry.transcripts.aiTranscription.createAiTranscriptionService({
      config,
      auth: authService,
      networkUtils,
      chromeClient,
      errors: registry.errors,
      contentScriptMedia,
      log: transcriptsLog,
    });

    const sessionHandlers = registry.handlers.createSessionHandlers({ sessionStore });
    const settingsHandlers = registry.handlers.createSettingsHandlers({ settingsStore });
    const transcriptHandlers = registry.handlers.createTranscriptHandlers({
      transcriptExtraction,
      panoptoMedia,
      log: transcriptsLog,
    });
    const aiHandlers = registry.handlers.createAiTranscriptionHandlers({
      aiTranscription,
      contentScriptMedia,
    });

    const handlers = {
      ...sessionHandlers,
      ...settingsHandlers,
      ...transcriptHandlers,
      ...aiHandlers,
    };

    const validators = registry.validators.createMessageValidators();
    const handleMessage = registry.router.createMessageRouter({
      handlers,
      validators,
      getMessageType: registry.validators.getMessageType,
      respond,
      log,
    });

    function init() {
      registry.contextMenus.registerContextMenus({ chromeClient, log });
      registry.lifecycle.registerLifecycleListeners({ chromeClient, sessionStore, log });

      if (messaging && typeof messaging.setupMessageListener === 'function') {
        messaging.setupMessageListener(handleMessage);
      } else if (chromeClient.runtime?.onMessage) {
        chromeClient.runtime.onMessage.addListener((message, sender, sendResponse) => {
          handleMessage(message, sender)
            .then((response) => {
              sendResponse(response);
            })
            .catch((error) => {
              sendResponse({ error: error.message || String(error) });
            });
          return true;
        });
      }

      log.info('Lock-in background service worker started');
    }

    return {
      init,
      handleMessage,
    };
  }

  let initialized = false;

  function initBackground(deps) {
    if (initialized) return;
    initialized = true;
    const app = createBackgroundApp(deps);
    app.init();
    return app;
  }

  registry.index = {
    createBackgroundApp,
    initBackground,
  };
})();
