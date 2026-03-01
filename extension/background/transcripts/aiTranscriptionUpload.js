(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  const FALLBACK_FETCH_ERROR_MESSAGE =
    'Media could not be fetched due to browser restrictions (CORS/opaque response) or network errors.';

  function requireHelpers({ helpers, errors }) {
    if (helpers) return helpers;
    throw errors.createErrorWithCode('AI upload helpers unavailable.', 'NOT_AVAILABLE');
  }

  function normalizeDirectFetchError({ error, errors }) {
    if (error?.name === 'AbortError') throw error;
    if (error?.code) throw error;
    throw errors.createErrorWithCode(FALLBACK_FETCH_ERROR_MESSAGE, 'NOT_AVAILABLE');
  }

  function normalizeContentScriptError({ error, errors }) {
    throw errors.createErrorWithCode(
      error?.message || 'Media could not be fetched via content script.',
      error?.code || 'CONTENT_FETCH_ERROR',
    );
  }

  function createUploadMediaInChunks({ helpers, errors, log }) {
    return async function uploadMediaInChunks({
      jobId,
      mediaUrl,
      token,
      signal,
      onProgress,
      tabId,
      requestId,
    }) {
      const uploadHelpers = requireHelpers({ helpers, errors });
      let response;

      try {
        response = await uploadHelpers.fetchDirectMediaResponse({ mediaUrl, signal });
      } catch (error) {
        if (uploadHelpers.shouldFallbackToContentScript(error) && tabId) {
          log.info('Trying content script fallback for media fetch');
          try {
            return await uploadHelpers.uploadViaContentScript({
              tabId,
              mediaUrl,
              jobId,
              requestId,
              token,
              signal,
              onProgress,
            });
          } catch (contentError) {
            log.error('Content script fallback failed:', contentError);
            normalizeContentScriptError({ error: contentError, errors });
          }
        }
        normalizeDirectFetchError({ error, errors });
      }

      try {
        return await uploadHelpers.streamAndUploadResponse({
          response,
          jobId,
          token,
          signal,
          onProgress,
        });
      } catch (error) {
        if (error?.message === 'Streaming not supported for this media.') {
          throw errors.createErrorWithCode(error.message, 'NOT_AVAILABLE');
        }
        throw error;
      }
    };
  }

  function createAiTranscriptionUploadService({
    config,
    aiUtils,
    errors,
    contentScriptMedia,
    log,
    chunkBytes,
    networkUtils,
  }) {
    const helpersFactory =
      transcripts.aiTranscriptionUploadHelpers?.createAiTranscriptionUploadHelpers;
    const helpers =
      typeof helpersFactory === 'function'
        ? helpersFactory({
            config,
            aiUtils,
            errors,
            contentScriptMedia,
            log,
            chunkBytes,
            fetchWithRetry: networkUtils?.fetchWithRetry,
          })
        : null;

    return {
      uploadMediaInChunks: createUploadMediaInChunks({ helpers, errors, log }),
    };
  }

  transcripts.aiTranscriptionUpload = {
    createAiTranscriptionUploadService,
  };
})();
