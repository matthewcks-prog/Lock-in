(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createPanoptoMediaService({
    transcriptProviders,
    panoptoResolver,
    createExtensionFetcher,
    log,
  }) {
    const PanoptoMediaResolver = panoptoResolver?.PanoptoMediaResolver;

    function buildFailure(error, errorCode) {
      return {
        success: false,
        error,
        errorCode,
      };
    }

    async function resolvePanoptoInfo(video) {
      if (video?.panoptoTenant && video?.id) {
        return { info: { tenant: video.panoptoTenant, deliveryId: video.id } };
      }

      if (video?.embedUrl && typeof transcriptProviders?.extractPanoptoInfo === 'function') {
        const info = transcriptProviders.extractPanoptoInfo(video.embedUrl);
        if (info) {
          return { info };
        }
      }

      if (
        video?.embedUrl &&
        typeof transcriptProviders?.resolvePanoptoInfoFromWrapperUrl === 'function'
      ) {
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

      return { info: null };
    }

    async function fetchPanoptoMediaUrl(video, options = {}) {
      log.info('Fetching Panopto media URL for AI transcription');
      log.info('Video:', {
        id: video?.id,
        provider: video?.provider,
        embedUrl: video?.embedUrl,
        panoptoTenant: video?.panoptoTenant,
      });

      if (video?.provider !== 'panopto') {
        return buildFailure('Not a Panopto video');
      }

      try {
        const tabId = options?.tabId || null;
        const resolution = await resolvePanoptoInfo(video);
        if (resolution.error) {
          return buildFailure(resolution.error, resolution.errorCode);
        }
        const resolvedInfo = resolution.info;

        if (!resolvedInfo) {
          return buildFailure(
            'Could not resolve this Panopto link. Open the video once and try again.',
            'NOT_AVAILABLE',
          );
        }

        if (
          !PanoptoMediaResolver ||
          typeof transcriptProviders?.buildPanoptoEmbedUrl !== 'function'
        ) {
          return buildFailure('Panopto helpers are not available.', 'NOT_AVAILABLE');
        }

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
        log.info('Panopto media URL fetch (v2) result:', resolverResult.ok);
        return {
          success: resolverResult.ok,
          mediaUrl: resolverResult.mediaUrl,
          mime: resolverResult.mime,
          method: resolverResult.method,
          error: resolverResult.message,
          errorCode: resolverResult.errorCode,
          debug: resolverResult.debug,
        };
      } catch (error) {
        log.error('Error fetching Panopto media URL:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch media URL',
        };
      }
    }

    return {
      fetchPanoptoMediaUrl,
    };
  }

  transcripts.panoptoMedia = {
    createPanoptoMediaService,
  };
})();
