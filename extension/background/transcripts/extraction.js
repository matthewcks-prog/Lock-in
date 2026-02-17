(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function buildExtractionFailure(error, errorCode = 'NOT_AVAILABLE') {
    return {
      success: false,
      error,
      errorCode,
      aiTranscriptionAvailable: true,
    };
  }

  function validateExtractionRequest(video, transcriptProviders) {
    if (!video || !video.provider) {
      return buildExtractionFailure('No video provider specified', 'INVALID_VIDEO');
    }
    if (!transcriptProviders) {
      return buildExtractionFailure('Transcript providers are not available');
    }
    return null;
  }

  function resolveProvider({ transcriptRegistry, video }) {
    transcriptRegistry.ensureProvidersRegistered();
    const provider = transcriptRegistry.getProviderForVideo(video);
    if (!provider || typeof provider.extractTranscript !== 'function') {
      return null;
    }
    return provider;
  }

  async function extractTranscript({
    video,
    transcriptProviders,
    transcriptRegistry,
    createExtensionFetcher,
    log,
  }) {
    log.info('handleTranscriptExtraction called');
    const invalidRequest = validateExtractionRequest(video, transcriptProviders);
    if (invalidRequest) return invalidRequest;

    const provider = resolveProvider({ transcriptRegistry, video });
    if (!provider) {
      return buildExtractionFailure(`Unsupported video provider: ${video.provider}`);
    }

    try {
      const fetcher = createExtensionFetcher();
      const result = await provider.extractTranscript(video, fetcher);
      log.info('Transcript extraction completed', {
        provider: provider.provider,
        success: result.success,
        errorCode: result.errorCode,
        hasTranscript: Boolean(result.transcript),
        transcriptSegments: result.transcript?.segments?.length,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Transcript extraction failed:', message);
      return buildExtractionFailure(message || 'Failed to extract transcript');
    }
  }

  function normalizeEcho360Context(context) {
    if (!context || !context.pageUrl) {
      return null;
    }
    return {
      pageUrl: context.pageUrl,
      iframes: Array.isArray(context.iframes) ? context.iframes : [],
    };
  }

  function mapVideoDebug(videos) {
    return videos.map((video) => ({
      id: video.id,
      provider: video.provider,
      title: video.title,
      lessonId: video.echoLessonId,
      mediaId: video.echoMediaId,
      baseUrl: video.echoBaseUrl,
    }));
  }

  async function detectEcho360WithProvider({ provider, context, fetcher, log }) {
    log.info('Echo360 provider created, starting detection', {
      pageUrl: context.pageUrl,
      iframeCount: context.iframes.length,
      hasDetectVideosAsync: typeof provider.detectVideosAsync === 'function',
      hasDetectVideosSync: typeof provider.detectVideosSync === 'function',
    });

    if (typeof provider.detectVideosAsync === 'function') {
      log.info('Using async detection');
      const videos = await provider.detectVideosAsync(context, fetcher);
      log.info('Echo360 async detection completed', {
        videoCount: videos.length,
        videos: mapVideoDebug(videos),
      });
      return { success: true, videos };
    }

    if (typeof provider.detectVideosSync === 'function') {
      log.info('Using sync detection');
      const videos = provider.detectVideosSync(context);
      log.info('Echo360 sync detection completed', {
        videoCount: videos.length,
        videos: mapVideoDebug(videos),
      });
      return { success: true, videos };
    }

    log.warn('Echo360 provider missing detection methods');
    return { success: false, error: 'Echo360 provider missing detection methods' };
  }

  async function detectEcho360Videos({
    context,
    transcriptProviders,
    createExtensionFetcher,
    log,
  }) {
    log.info('handleEcho360VideoDetection called', {
      hasContext: Boolean(context),
      pageUrl: context?.pageUrl,
      iframeCount: Array.isArray(context?.iframes) ? context.iframes.length : 0,
      iframes: context?.iframes,
    });

    const normalizedContext = normalizeEcho360Context(context);
    if (!normalizedContext) {
      log.warn('No detection context provided for Echo360');
      return { success: false, error: 'No detection context provided' };
    }

    if (!transcriptProviders?.Echo360Provider) {
      log.warn('Echo360 provider is not available');
      return { success: false, error: 'Echo360 provider is not available' };
    }

    try {
      const provider = new transcriptProviders.Echo360Provider();
      const fetcher = createExtensionFetcher();
      return await detectEcho360WithProvider({
        provider,
        context: normalizedContext,
        fetcher,
        log,
      });
    } catch (error) {
      log.error('Echo360 detection failed', {
        error: error?.message,
        stack: error?.stack,
        errorObject: error,
      });
      return { success: false, error: error?.message || 'Echo360 detection failed' };
    }
  }

  function createTranscriptExtractionService({
    transcriptProviders,
    transcriptRegistry,
    createExtensionFetcher,
    log,
  }) {
    return {
      extractTranscript: (video) =>
        extractTranscript({
          video,
          transcriptProviders,
          transcriptRegistry,
          createExtensionFetcher,
          log,
        }),
      detectEcho360Videos: (context) =>
        detectEcho360Videos({
          context,
          transcriptProviders,
          createExtensionFetcher,
          log,
        }),
    };
  }

  transcripts.extraction = {
    createTranscriptExtractionService,
  };
})();
