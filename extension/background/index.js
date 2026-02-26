(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createCoreServices({ chrome, messaging, lockinConfig, networkUtils }) {
    const log = registry.logging.createLogger({ prefix: '[Lock-in BG]' });
    const chromeClient = registry.chromeClient.createChromeClient(chrome);
    const config = registry.config.createConfig(lockinConfig);
    const respond = registry.responder.createResponder(messaging);
    const transcriptsLog = log.withPrefix('[Transcripts]');
    const runtimeValidators = registry.validators.createRuntimeValidators();
    return { log, chromeClient, config, respond, transcriptsLog, runtimeValidators, networkUtils };
  }

  function createStorageServices({ chromeClient, log, runtimeValidators }) {
    const sessionStore = registry.sessions.createSessionStore({
      chromeClient,
      log,
      validators: runtimeValidators,
    });
    const settingsStore = registry.settings.createSettingsStore({
      chromeClient,
      log,
      validators: runtimeValidators,
    });
    return { sessionStore, settingsStore };
  }

  function createTranscriptServices({
    transcriptProviders,
    panoptoResolver,
    networkUtils,
    chromeClient,
    config,
    transcriptsLog,
    runtimeValidators,
    authService,
  }) {
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
      validators: runtimeValidators,
    });
    return { transcriptExtraction, panoptoMedia, contentScriptMedia, aiTranscription };
  }

  function createHandlers({ sessionStore, settingsStore, transcriptServices, transcriptsLog }) {
    const sessionHandlers = registry.handlers.createSessionHandlers({ sessionStore });
    const settingsHandlers = registry.handlers.createSettingsHandlers({ settingsStore });
    const transcriptHandlers = registry.handlers.createTranscriptHandlers({
      transcriptExtraction: transcriptServices.transcriptExtraction,
      panoptoMedia: transcriptServices.panoptoMedia,
      log: transcriptsLog,
    });
    const aiHandlers = registry.handlers.createAiTranscriptionHandlers({
      aiTranscription: transcriptServices.aiTranscription,
      contentScriptMedia: transcriptServices.contentScriptMedia,
    });
    const seekHandlers = registry.handlers.createSeekHandlers
      ? registry.handlers.createSeekHandlers({ log: transcriptsLog })
      : {};
    return {
      ...sessionHandlers,
      ...settingsHandlers,
      ...transcriptHandlers,
      ...aiHandlers,
      ...seekHandlers,
    };
  }

  function registerMessageListener({ messaging, chromeClient, handleMessage }) {
    if (messaging && typeof messaging.setupMessageListener === 'function') {
      messaging.setupMessageListener(handleMessage);
      return;
    }
    if (!chromeClient.runtime?.onMessage) return;
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

  function createInit({ core, storageServices, messaging, handleMessage }) {
    return function init() {
      registry.contextMenus.registerContextMenus({
        chromeClient: core.chromeClient,
        log: core.log,
      });
      registry.lifecycle.registerLifecycleListeners({
        chromeClient: core.chromeClient,
        sessionStore: storageServices.sessionStore,
        log: core.log,
      });
      registerMessageListener({ messaging, chromeClient: core.chromeClient, handleMessage });
      core.log.info('Lock-in background service worker started');
    };
  }

  function createBackgroundApp({
    chrome,
    messaging,
    transcriptProviders,
    networkUtils,
    panoptoResolver,
    lockinConfig,
  }) {
    const core = createCoreServices({ chrome, messaging, lockinConfig, networkUtils });
    const storageServices = createStorageServices({
      chromeClient: core.chromeClient,
      log: core.log,
      runtimeValidators: core.runtimeValidators,
    });
    const authService = registry.auth.createAuthService({
      chromeClient: core.chromeClient,
      config: core.config,
      log: core.log,
      networkUtils: core.networkUtils,
      validators: core.runtimeValidators,
    });
    const transcriptServices = createTranscriptServices({
      transcriptProviders,
      panoptoResolver,
      networkUtils: core.networkUtils,
      chromeClient: core.chromeClient,
      config: core.config,
      transcriptsLog: core.transcriptsLog,
      runtimeValidators: core.runtimeValidators,
      authService,
    });
    const handlers = createHandlers({
      sessionStore: storageServices.sessionStore,
      settingsStore: storageServices.settingsStore,
      transcriptServices,
      transcriptsLog: core.transcriptsLog,
    });
    const messageValidators = registry.validators.createMessageValidators();
    const handleMessage = registry.router.createMessageRouter({
      handlers,
      validators: messageValidators,
      getMessageType: registry.validators.getMessageType,
      respond: core.respond,
      log: core.log,
    });
    const init = createInit({ core, storageServices, messaging, handleMessage });
    return { init, handleMessage };
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
