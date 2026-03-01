(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function createCompletionPromise() {
    let resolveComplete;
    let rejectComplete;
    const completePromise = new Promise((resolve, reject) => {
      resolveComplete = resolve;
      rejectComplete = reject;
    });
    return { completePromise, resolveComplete, rejectComplete };
  }

  function parseChunkBytes(chunkData) {
    if (chunkData instanceof ArrayBuffer) {
      return new Uint8Array(chunkData);
    }
    if (ArrayBuffer.isView(chunkData)) {
      return new Uint8Array(chunkData.buffer, chunkData.byteOffset, chunkData.byteLength);
    }
    if (typeof chunkData === 'string') {
      return base64ToArrayBuffer(chunkData);
    }
    return null;
  }

  async function fetchMediaViaContentScript({
    chromeClient,
    errors,
    log,
    pendingMediaChunks,
    tabId,
    mediaUrl,
    jobId,
    requestId,
    onChunk,
  }) {
    log.info('Requesting content script to fetch media:', mediaUrl);
    const completion = createCompletionPromise();
    pendingMediaChunks.set(requestId, {
      onChunk,
      resolve: completion.resolveComplete,
      reject: completion.rejectComplete,
    });

    try {
      const result = await chromeClient.sendTabMessage(tabId, {
        type: 'FETCH_MEDIA_FOR_TRANSCRIPTION',
        payload: { mediaUrl, jobId, requestId },
      });
      log.info('Content script fetch result:', result);

      if (!result || !result.success) {
        throw errors.createErrorWithCode(
          result?.error || 'Content script failed to fetch media',
          result?.errorCode || 'CONTENT_FETCH_ERROR',
        );
      }

      log.info('Waiting for all chunks to be uploaded...');
      await completion.completePromise;
      log.info('All chunks uploaded successfully');
      return result;
    } catch (error) {
      log.error('Content script media fetch error:', error);
      throw error;
    } finally {
      pendingMediaChunks.delete(requestId);
    }
  }

  async function handleMediaChunkMessage({ log, pendingMediaChunks, message }) {
    const { requestId, chunkIndex, chunkData, chunkSize, isLast } = message.payload || {};
    const handler = pendingMediaChunks.get(requestId);
    if (!handler) {
      log.warn('Received chunk for unknown request:', requestId);
      return { received: false, error: 'UNKNOWN_REQUEST' };
    }

    log.info('Received chunk:', chunkIndex, 'size:', chunkSize, 'isLast:', isLast);
    const chunkBytes = parseChunkBytes(chunkData);
    if (chunkSize > 0 && (!chunkBytes || chunkBytes.length === 0)) {
      const error = new Error('Missing media chunk payload');
      handler.reject(error);
      throw error;
    }

    if (chunkBytes && chunkBytes.length > 0) {
      await handler.onChunk(chunkBytes, chunkIndex, isLast);
    }
    if (isLast) {
      handler.resolve({ success: true });
    }
    return { received: true };
  }

  function createContentScriptMediaService({ chromeClient, errors, log }) {
    const pendingMediaChunks = new Map();
    return {
      fetchMediaViaContentScript: ({ tabId, mediaUrl, jobId, requestId, onChunk }) =>
        fetchMediaViaContentScript({
          chromeClient,
          errors,
          log,
          pendingMediaChunks,
          tabId,
          mediaUrl,
          jobId,
          requestId,
          onChunk,
        }),
      handleMediaChunkMessage: (message) =>
        handleMediaChunkMessage({ log, pendingMediaChunks, message }),
    };
  }

  transcripts.contentScriptMedia = {
    createContentScriptMediaService,
  };
})();
