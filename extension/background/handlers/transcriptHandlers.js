(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const handlers = registry.handlers || (registry.handlers = {});

  function createTranscriptHandlers({ transcriptExtraction, panoptoMedia, log }) {
    async function extractTranscriptHandler({ message, payload, respond: responder }) {
      log.info('EXTRACT_TRANSCRIPT message received');
      const video = message?.video ?? payload?.video;
      if (!video) {
        log.warn('No video provided in EXTRACT_TRANSCRIPT message');
        return responder.errorWithFallback('No video provided', { error: 'No video provided' });
      }
      log.info('Processing EXTRACT_TRANSCRIPT for:', video.provider, video.id);
      const result = await transcriptExtraction.extractTranscript(video);
      log.info('EXTRACT_TRANSCRIPT result:', result.success);
      if (!responder.hasMessaging) {
        return result;
      }
      return result.success
        ? responder.success(result)
        : responder.error(result.error || 'Failed to extract transcript', result);
    }

    async function detectEcho360Handler({ payload, respond: responder }) {
      const context = payload?.context;
      const result = await transcriptExtraction.detectEcho360Videos(context);
      if (!responder.hasMessaging) {
        return result;
      }
      return result.success
        ? responder.success(result)
        : responder.error(result.error || 'Echo360 detection failed', result);
    }

    async function fetchPanoptoMediaHandler({ message, payload, sender, respond: responder }) {
      log.info('FETCH_PANOPTO_MEDIA_URL message received');
      const video = message?.video ?? payload?.video;
      if (!video) {
        log.warn('No video provided in FETCH_PANOPTO_MEDIA_URL message');
        return responder.errorWithFallback('No video provided', {
          success: false,
          error: 'No video provided',
        });
      }
      log.info('Fetching media URL for:', video.provider, video.id);
      const result = await panoptoMedia.fetchPanoptoMediaUrl(video, { tabId: sender?.tab?.id });
      log.info('FETCH_PANOPTO_MEDIA_URL result:', result.success);
      if (!responder.hasMessaging) {
        return result;
      }
      return result.success
        ? responder.success(result)
        : responder.error(result.error || 'Failed to fetch media URL', result);
    }

    return {
      extractTranscript: extractTranscriptHandler,
      EXTRACT_TRANSCRIPT: extractTranscriptHandler,
      DETECT_ECHO360_VIDEOS: detectEcho360Handler,
      FETCH_PANOPTO_MEDIA_URL: fetchPanoptoMediaHandler,
    };
  }

  handlers.createTranscriptHandlers = createTranscriptHandlers;
})();
