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

    async function fetchPanoptoMediaUrl(video, options = {}) {
      log.info('Fetching Panopto media URL for AI transcription');
      log.info('Video:', {
        id: video?.id,
        provider: video?.provider,
        embedUrl: video?.embedUrl,
        panoptoTenant: video?.panoptoTenant,
      });

      if (video?.provider !== 'panopto') {
        return {
          success: false,
          error: 'Not a Panopto video',
        };
      }

      try {
        const tabId = options?.tabId || null;
        let resolvedInfo = null;

        if (video?.panoptoTenant && video?.id) {
          resolvedInfo = { tenant: video.panoptoTenant, deliveryId: video.id };
        } else if (
          video?.embedUrl &&
          typeof transcriptProviders?.extractPanoptoInfo === 'function'
        ) {
          resolvedInfo = transcriptProviders.extractPanoptoInfo(video.embedUrl);
        }

        if (
          !resolvedInfo &&
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
              success: false,
              error: 'Authentication required. Please log in to Panopto.',
              errorCode: 'AUTH_REQUIRED',
            };
          }
          resolvedInfo = resolved.info;
        }

        if (!resolvedInfo) {
          return {
            success: false,
            error: 'Could not resolve this Panopto link. Open the video once and try again.',
            errorCode: 'NOT_AVAILABLE',
          };
        }

        if (typeof transcriptProviders?.buildPanoptoEmbedUrl !== 'function') {
          return {
            success: false,
            error: 'Panopto helpers are not available.',
            errorCode: 'NOT_AVAILABLE',
          };
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
