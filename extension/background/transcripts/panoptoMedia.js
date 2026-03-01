(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function buildFailure(error, errorCode) {
    return { success: false, error, errorCode };
  }

  function logPanoptoVideo(log, video) {
    log.info('Fetching Panopto media URL for AI transcription');
    log.info('Video:', {
      id: video?.id,
      provider: video?.provider,
      embedUrl: video?.embedUrl,
      panoptoTenant: video?.panoptoTenant,
    });
  }

  function ensurePanoptoVideo(video) {
    if (video?.provider === 'panopto') return null;
    return buildFailure('Not a Panopto video');
  }

  async function resolvePanoptoInfo({ video, transcriptProviders, createExtensionFetcher }) {
    if (video?.panoptoTenant && video?.id) {
      return { info: { tenant: video.panoptoTenant, deliveryId: video.id } };
    }

    if (video?.embedUrl && typeof transcriptProviders?.extractPanoptoInfo === 'function') {
      const info = transcriptProviders.extractPanoptoInfo(video.embedUrl);
      if (info) {
        return { info };
      }
    }

    const canResolveFromWrapper =
      video?.embedUrl &&
      typeof transcriptProviders?.resolvePanoptoInfoFromWrapperUrl === 'function';
    if (!canResolveFromWrapper) {
      return { info: null };
    }

    const fetcher = createExtensionFetcher();
    const resolved = await transcriptProviders.resolvePanoptoInfoFromWrapperUrl(
      video.embedUrl,
      fetcher,
    );
    if (resolved.authRequired) {
      return {
        error: 'Authentication required. Please log in to Panopto.',
        errorCode: 'AUTH_REQUIRED',
      };
    }
    return { info: resolved.info };
  }

  function ensurePanoptoResolver({ PanoptoMediaResolver, transcriptProviders }) {
    const hasBuildUrl = typeof transcriptProviders?.buildPanoptoEmbedUrl === 'function';
    if (PanoptoMediaResolver && hasBuildUrl) return null;
    return buildFailure('Panopto helpers are not available.', 'NOT_AVAILABLE');
  }

  async function resolvePanoptoMedia({
    PanoptoMediaResolver,
    transcriptProviders,
    resolvedInfo,
    tabId,
  }) {
    const resolvedEmbedUrl = transcriptProviders.buildPanoptoEmbedUrl(
      resolvedInfo.tenant,
      resolvedInfo.deliveryId,
    );
    const resolverResult = await PanoptoMediaResolver.resolve({
      tenant: resolvedInfo.tenant,
      deliveryId: resolvedInfo.deliveryId,
      embedUrl: resolvedEmbedUrl,
      tabId,
    });
    return {
      success: resolverResult.ok,
      mediaUrl: resolverResult.mediaUrl,
      mime: resolverResult.mime,
      method: resolverResult.method,
      error: resolverResult.message,
      errorCode: resolverResult.errorCode,
      debug: resolverResult.debug,
    };
  }

  async function fetchPanoptoMediaUrl({
    video,
    options,
    transcriptProviders,
    createExtensionFetcher,
    PanoptoMediaResolver,
    log,
  }) {
    logPanoptoVideo(log, video);
    const invalidProvider = ensurePanoptoVideo(video);
    if (invalidProvider) return invalidProvider;

    try {
      const tabId = options?.tabId || null;
      const infoResolution = await resolvePanoptoInfo({
        video,
        transcriptProviders,
        createExtensionFetcher,
      });
      if (infoResolution.error) {
        return buildFailure(infoResolution.error, infoResolution.errorCode);
      }
      if (!infoResolution.info) {
        return buildFailure(
          'Could not resolve this Panopto link. Open the video once and try again.',
          'NOT_AVAILABLE',
        );
      }

      const missingResolver = ensurePanoptoResolver({ PanoptoMediaResolver, transcriptProviders });
      if (missingResolver) return missingResolver;

      const response = await resolvePanoptoMedia({
        PanoptoMediaResolver,
        transcriptProviders,
        resolvedInfo: infoResolution.info,
        tabId,
      });
      log.info('Panopto media URL fetch (v2) result:', response.success);
      return response;
    } catch (error) {
      log.error('Error fetching Panopto media URL:', error);
      return buildFailure(error.message || 'Failed to fetch media URL');
    }
  }

  function createPanoptoMediaService({
    transcriptProviders,
    panoptoResolver,
    createExtensionFetcher,
    log,
  }) {
    const PanoptoMediaResolver = panoptoResolver?.PanoptoMediaResolver;
    return {
      fetchPanoptoMediaUrl: (video, options = {}) =>
        fetchPanoptoMediaUrl({
          video,
          options,
          transcriptProviders,
          createExtensionFetcher,
          PanoptoMediaResolver,
          log,
        }),
    };
  }

  transcripts.panoptoMedia = {
    createPanoptoMediaService,
  };
})();
