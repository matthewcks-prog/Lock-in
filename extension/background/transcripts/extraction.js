(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createTranscriptExtractionService({
    transcriptProviders,
    transcriptRegistry,
    createExtensionFetcher,
    log,
  }) {
    async function extractTranscript(video) {
      log.info('handleTranscriptExtraction called');
      if (!video || !video.provider) {
        return {
          success: false,
          error: 'No video provider specified',
          errorCode: 'INVALID_VIDEO',
          aiTranscriptionAvailable: true,
        };
      }

      if (!transcriptProviders) {
        return {
          success: false,
          error: 'Transcript providers are not available',
          errorCode: 'NOT_AVAILABLE',
          aiTranscriptionAvailable: true,
        };
      }

      transcriptRegistry.ensureProvidersRegistered();
      const provider = transcriptRegistry.getProviderForVideo(video);
      if (!provider || typeof provider.extractTranscript !== 'function') {
        return {
          success: false,
          error: `Unsupported video provider: ${video.provider}`,
          errorCode: 'NOT_AVAILABLE',
          aiTranscriptionAvailable: true,
        };
      }

      try {
        const fetcher = createExtensionFetcher();
        const result = await provider.extractTranscript(video, fetcher);
        log.info('Transcript extraction completed', {
          provider: provider.provider,
          success: result.success,
          errorCode: result.errorCode,
          hasTranscript: !!result.transcript,
          transcriptSegments: result.transcript?.segments?.length,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error('Transcript extraction failed:', message);
        return {
          success: false,
          error: message || 'Failed to extract transcript',
          errorCode: 'NOT_AVAILABLE',
          aiTranscriptionAvailable: true,
        };
      }
    }

    async function detectEcho360Videos(context) {
      log.info('handleEcho360VideoDetection called', {
        hasContext: !!context,
        pageUrl: context?.pageUrl,
        iframeCount: Array.isArray(context?.iframes) ? context.iframes.length : 0,
        iframes: context?.iframes,
      });

      if (!context || !context.pageUrl) {
        log.warn('No detection context provided for Echo360');
        return {
          success: false,
          error: 'No detection context provided',
        };
      }

      if (transcriptProviders && transcriptProviders.Echo360Provider) {
        try {
          const provider = new transcriptProviders.Echo360Provider();
          const fetcher = createExtensionFetcher();
          const normalizedContext = {
            pageUrl: context.pageUrl,
            iframes: Array.isArray(context.iframes) ? context.iframes : [],
          };
          log.info('Echo360 provider created, starting detection', {
            pageUrl: normalizedContext.pageUrl,
            iframeCount: normalizedContext.iframes.length,
            hasDetectVideosAsync: typeof provider.detectVideosAsync === 'function',
            hasDetectVideosSync: typeof provider.detectVideosSync === 'function',
          });

          if (typeof provider.detectVideosAsync === 'function') {
            log.info('Using async detection');
            const videos = await provider.detectVideosAsync(normalizedContext, fetcher);
            log.info('Echo360 async detection completed', {
              videoCount: videos.length,
              videos: videos.map((v) => ({
                id: v.id,
                provider: v.provider,
                title: v.title,
                lessonId: v.echoLessonId,
                mediaId: v.echoMediaId,
                baseUrl: v.echoBaseUrl,
              })),
            });
            return { success: true, videos };
          }
          if (typeof provider.detectVideosSync === 'function') {
            log.info('Using sync detection');
            const videos = provider.detectVideosSync(normalizedContext);
            log.info('Echo360 sync detection completed', {
              videoCount: videos.length,
              videos: videos.map((v) => ({
                id: v.id,
                provider: v.provider,
                title: v.title,
                lessonId: v.echoLessonId,
                mediaId: v.echoMediaId,
                baseUrl: v.echoBaseUrl,
              })),
            });
            return { success: true, videos };
          }
          log.warn('Echo360 provider missing detection methods');
        } catch (error) {
          log.error('Echo360 detection failed', {
            error: error?.message,
            stack: error?.stack,
            errorObject: error,
          });
          return {
            success: false,
            error: error?.message || 'Echo360 detection failed',
          };
        }
      }

      log.warn('Echo360 provider is not available');
      return {
        success: false,
        error: 'Echo360 provider is not available',
      };
    }

    return {
      extractTranscript,
      detectEcho360Videos,
    };
  }

  transcripts.extraction = {
    createTranscriptExtractionService,
  };
})();
