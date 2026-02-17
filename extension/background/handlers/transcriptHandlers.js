(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const handlers = registry.handlers || (registry.handlers = {});

  function respondWithResult(responder, result, fallbackErrorMessage) {
    if (!responder.hasMessaging) {
      return result;
    }
    return result.success
      ? responder.success(result)
      : responder.error(result.error || fallbackErrorMessage, result);
  }

  function missingVideoResponse(responder) {
    return responder.errorWithFallback('No video provided', {
      success: false,
      error: 'No video provided',
    });
  }

  function createExtractTranscriptHandler({ transcriptExtraction, log }) {
    return async function extractTranscriptHandler({ message, payload, respond: responder }) {
      log.info('EXTRACT_TRANSCRIPT message received');
      const video = message?.video ?? payload?.video;
      if (!video) {
        log.warn('No video provided in EXTRACT_TRANSCRIPT message');
        return responder.errorWithFallback('No video provided', { error: 'No video provided' });
      }
      log.info('Processing EXTRACT_TRANSCRIPT for:', video.provider, video.id);
      const result = await transcriptExtraction.extractTranscript(video);
      log.info('EXTRACT_TRANSCRIPT result:', result.success);
      return respondWithResult(responder, result, 'Failed to extract transcript');
    };
  }

  function createDetectEcho360Handler({ transcriptExtraction }) {
    return async function detectEcho360Handler({ payload, respond: responder }) {
      const context = payload?.context;
      const result = await transcriptExtraction.detectEcho360Videos(context);
      return respondWithResult(responder, result, 'Echo360 detection failed');
    };
  }

  function createFetchPanoptoMediaHandler({ panoptoMedia, log }) {
    return async function fetchPanoptoMediaHandler({
      message,
      payload,
      sender,
      respond: responder,
    }) {
      log.info('FETCH_PANOPTO_MEDIA_URL message received');
      const video = message?.video ?? payload?.video;
      if (!video) {
        log.warn('No video provided in FETCH_PANOPTO_MEDIA_URL message');
        return missingVideoResponse(responder);
      }
      log.info('Fetching media URL for:', video.provider, video.id);
      const result = await panoptoMedia.fetchPanoptoMediaUrl(video, { tabId: sender?.tab?.id });
      log.info('FETCH_PANOPTO_MEDIA_URL result:', result.success);
      return respondWithResult(responder, result, 'Failed to fetch media URL');
    };
  }

  function createTranscriptHandlers({ transcriptExtraction, panoptoMedia, log }) {
    const extractTranscriptHandler = createExtractTranscriptHandler({ transcriptExtraction, log });
    const detectEcho360Handler = createDetectEcho360Handler({ transcriptExtraction });
    const fetchPanoptoMediaHandler = createFetchPanoptoMediaHandler({ panoptoMedia, log });

    return {
      extractTranscript: extractTranscriptHandler,
      EXTRACT_TRANSCRIPT: extractTranscriptHandler,
      DETECT_ECHO360_VIDEOS: detectEcho360Handler,
      FETCH_PANOPTO_MEDIA_URL: fetchPanoptoMediaHandler,
    };
  }

  handlers.createTranscriptHandlers = createTranscriptHandlers;
})();
