(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});
  const AI_UPLOAD_CHUNK_SIZE_MIB = 4,
    BYTES_PER_KIB = 1024,
    AI_UPLOAD_CHUNK_BYTES = AI_UPLOAD_CHUNK_SIZE_MIB * BYTES_PER_KIB * BYTES_PER_KIB,
    AI_POLL_INTERVAL_MS = 3000,
    AI_POLL_MAX_ATTEMPTS = 160;

  function createDependencyAccessors({ errors, helpers, requests, uploadService, pollingService }) {
    function requireService(value, message) {
      if (!value) {
        throw errors.createErrorWithCode(message, 'NOT_AVAILABLE');
      }
      return value;
    }
    return {
      requireHelpers: () => requireService(helpers, 'AI transcription helpers unavailable.'),
      requireRequests: () => requireService(requests, 'AI transcription requests unavailable.'),
      requireUploadService: () => requireService(uploadService, 'Upload service unavailable.'),
      requirePollingService: () => requireService(pollingService, 'Polling service unavailable.'),
    };
  }

  function getDependencyFactories() {
    return {
      helpersFactory: transcripts.aiTranscriptionHelpers?.createAiTranscriptionHelpers || null,
      requestsFactory: transcripts.aiTranscriptionRequests?.createAiTranscriptionRequests || null,
      uploadServiceFactory:
        transcripts.aiTranscriptionUpload?.createAiTranscriptionUploadService || null,
      pollingServiceFactory:
        transcripts.aiTranscriptionPolling?.createAiTranscriptionPollingService || null,
    };
  }

  function createPollingService({ config, requests, validators, pollingServiceFactory }) {
    if (!requests || !pollingServiceFactory) {
      return null;
    }
    return pollingServiceFactory({
      config,
      fetchJsonWithAuth: requests.fetchJsonWithAuth,
      pollIntervalMs: AI_POLL_INTERVAL_MS,
      pollMaxAttempts: AI_POLL_MAX_ATTEMPTS,
      validators,
    });
  }

  function createAiTranscriptionDependencies({
    config,
    auth,
    networkUtils,
    chromeClient,
    errors,
    contentScriptMedia,
    log,
    validators,
  }) {
    const factories = getDependencyFactories();
    const aiUtils = transcripts.aiUtils || {};
    const helpers =
      factories.helpersFactory?.({
        aiUtils,
        auth,
        errors,
        log,
        chromeClient,
        chunkBytes: AI_UPLOAD_CHUNK_BYTES,
      }) || null;
    const requests =
      factories.requestsFactory?.({ config, networkUtils, aiUtils, validators }) || null;
    const uploadService =
      factories.uploadServiceFactory?.({
        config,
        aiUtils,
        errors,
        contentScriptMedia,
        log,
        chunkBytes: AI_UPLOAD_CHUNK_BYTES,
        networkUtils,
      }) || null;
    const pollingService = createPollingService({
      config,
      requests,
      validators,
      pollingServiceFactory: factories.pollingServiceFactory,
    });
    return { aiUtils, helpers, requests, uploadService, pollingService };
  }

  function createFallbackFlow(errors) {
    const unavailable = async () => {
      throw errors.createErrorWithCode('AI transcription flow unavailable.', 'NOT_AVAILABLE');
    };
    return {
      handleAiTranscriptionStart: unavailable,
      handleAiTranscriptionCancel: unavailable,
    };
  }

  function createAiTranscriptionService({
    config,
    auth,
    networkUtils,
    chromeClient,
    errors,
    contentScriptMedia,
    log,
    validators,
  }) {
    const jobs = new Map();
    const dependencies = createAiTranscriptionDependencies({
      config,
      auth,
      networkUtils,
      chromeClient,
      errors,
      contentScriptMedia,
      log,
      validators,
    });
    const accessors = createDependencyAccessors({
      errors,
      helpers: dependencies.helpers,
      requests: dependencies.requests,
      uploadService: dependencies.uploadService,
      pollingService: dependencies.pollingService,
    });
    const flowFactory = transcripts.aiTranscriptionFlow?.createAiTranscriptionFlow;
    const flow =
      typeof flowFactory === 'function'
        ? flowFactory({
            accessors,
            aiUtils: dependencies.aiUtils,
            errors,
            jobs,
            auth,
            log,
          })
        : createFallbackFlow(errors);
    return {
      handleAiTranscriptionStart: flow.handleAiTranscriptionStart,
      handleAiTranscriptionCancel: flow.handleAiTranscriptionCancel,
      listActiveTranscriptJobs: (args) =>
        accessors.requireRequests().listActiveTranscriptJobs(args),
      cancelAllActiveTranscriptJobs: (args) =>
        accessors.requireRequests().cancelAllActiveTranscriptJobs(args),
    };
  }

  transcripts.aiTranscription = {
    createAiTranscriptionService,
  };
})();
