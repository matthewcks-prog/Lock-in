(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createAiTranscriptionUploadService({
    config,
    aiUtils,
    errors,
    contentScriptMedia,
    log,
    chunkBytes,
    networkUtils,
  }) {
    const fetchWithRetry = networkUtils?.fetchWithRetry;
    const CHUNK_UPLOAD_TIMEOUT_MS = 30000;
    const MEDIA_FETCH_MAX_RETRIES = 2;
    const MEDIA_FETCH_TIMEOUT_MS = 20000;
    const SSO_DOMAINS = [
      'okta.com',
      'auth0.com',
      'login.microsoftonline.com',
      'accounts.google.com',
    ];

    const isSsoRedirect = (url) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        return SSO_DOMAINS.some((domain) => hostname.includes(domain));
      } catch {
        return false;
      }
    };

    const isCdnUrl = (url) => {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        return (
          hostname.includes('cloudfront.net') ||
          hostname.includes('cdn.') ||
          hostname.includes('akamai') ||
          hostname.includes('fastly') ||
          hostname.includes('cloudflare')
        );
      } catch {
        return false;
      }
    };

    function buildChunkHeaders({ token, index, totalChunks }) {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'x-chunk-index': String(index),
      };
      if (totalChunks) {
        headers['x-total-chunks'] = String(totalChunks);
      }
      return headers;
    }

    async function parseErrorPayload(response) {
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    async function sendChunkWithRetry({
      backendUrl,
      jobId,
      token,
      signal,
      chunk,
      index,
      totalChunks,
      maxRetries = 5,
    }) {
      if (signal?.aborted) {
        throw new Error('CANCELED');
      }

      const url = `${backendUrl}/api/transcripts/jobs/${jobId}/chunks`;
      const requestOptions = {
        method: 'PUT',
        headers: buildChunkHeaders({ token, index, totalChunks }),
        body: chunk,
        signal,
      };

      if (typeof fetchWithRetry !== 'function') {
        throw new Error('Network utilities unavailable');
      }

      const response = await fetchWithRetry(url, requestOptions, {
        maxRetries,
        timeoutMs: CHUNK_UPLOAD_TIMEOUT_MS,
        retryableStatuses: [429, 502, 503, 504],
        retryOnServerError: true,
        onRetry: (info) => {
          log.info(
            `Retrying chunk ${index} in ${info.delayMs}ms (attempt ${info.attempt}/${maxRetries})`,
          );
        },
      });

      if (response.ok) {
        return;
      }

      const data = await parseErrorPayload(response);
      throw new Error(
        data?.error?.message || data?.error || `Chunk upload failed: ${response.status}`,
      );
    }

    async function fetchDirectMediaResponse(mediaUrl, signal) {
      log.info('Attempting direct media fetch:', mediaUrl);
      const initialOptions = {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
        signal,
      };
      if (typeof fetchWithRetry !== 'function') {
        throw errors.createErrorWithCode('Network utilities unavailable', 'NOT_AVAILABLE');
      }

      let response = await fetchWithRetry(
        mediaUrl,
        initialOptions,
        MEDIA_FETCH_MAX_RETRIES,
        MEDIA_FETCH_TIMEOUT_MS,
      );

      log.info('Initial response:', response.status, response.type);

      const isRedirect =
        response.type === 'opaqueredirect' ||
        response.status === 0 ||
        (response.status >= 300 && response.status < 400);

      if (isRedirect) {
        const location = response.headers.get('location');
        log.info('Redirect detected, location:', location);

        if (location) {
          if (isSsoRedirect(location)) {
            throw errors.createErrorWithCode(
              'Your session has expired. Please refresh the page and log in again.',
              'SESSION_EXPIRED',
            );
          }

          const useCredentials = !isCdnUrl(location);
          log.info('Following redirect, credentials:', useCredentials);

          const redirectOptions = {
            method: 'GET',
            credentials: useCredentials ? 'include' : 'omit',
            signal,
          };
          response = await fetchWithRetry(
            location,
            redirectOptions,
            MEDIA_FETCH_MAX_RETRIES,
            MEDIA_FETCH_TIMEOUT_MS,
          );
        } else {
          log.info('No location header, falling back to content script');
          throw errors.createErrorWithCode('CORS_BLOCKED', 'CORS_BLOCKED');
        }
      }

      if (response.type === 'opaque') {
        log.info('Got opaque response, will try content script fallback');
        throw errors.createErrorWithCode('CORS_BLOCKED', 'CORS_BLOCKED');
      }

      if (!response.ok) {
        if (aiUtils?.isAuthStatus?.(response.status)) {
          throw errors.createErrorWithCode(
            'Authentication required. Please refresh the page and log in.',
            'AUTH_REQUIRED',
          );
        }
        throw errors.createErrorWithCode(`HTTP ${response.status}`, 'FETCH_ERROR');
      }

      log.info('Direct fetch successful');
      return response;
    }

    function shouldFallbackToContentScript(error) {
      return (
        error?.code === 'CORS_BLOCKED' ||
        error?.code === 'NOT_AVAILABLE' ||
        (error?.message &&
          (error.message.includes('CORS') ||
            error.message.includes('opaque') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')))
      );
    }

    async function uploadViaContentScript({
      tabId,
      mediaUrl,
      jobId,
      requestId,
      token,
      signal,
      onProgress,
    }) {
      let uploadedBytes = 0;
      let chunkIndex = 0;

      await contentScriptMedia.fetchMediaViaContentScript({
        tabId,
        mediaUrl,
        jobId,
        requestId,
        onChunk: async (chunkBytes, index) => {
          await sendChunkWithRetry({
            backendUrl: config.getBackendUrl(),
            jobId,
            token,
            signal,
            chunk: chunkBytes,
            index,
          });
          uploadedBytes += chunkBytes.length;
          if (onProgress) {
            onProgress({ bytesUploaded: uploadedBytes, chunkIndex: index });
          }
          chunkIndex = index + 1;
        },
      });

      return {
        chunkCount: chunkIndex,
        totalChunks: chunkIndex,
        totalBytes: uploadedBytes,
        usedContentScript: true,
      };
    }

    async function streamAndUploadResponse({ response, jobId, token, signal, onProgress }) {
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw errors.createErrorWithCode(
          'Streaming not supported for this media.',
          'NOT_AVAILABLE',
        );
      }

      const totalBytesHeader = response.headers.get('content-length');
      const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
      const totalChunks =
        Number.isFinite(totalBytes) && totalBytes > 0 ? Math.ceil(totalBytes / chunkBytes) : null;

      const reader = response.body.getReader();
      let pending = new Uint8Array(0);
      let uploadedBytes = 0;
      let chunkIndex = 0;
      const backendUrl = config.getBackendUrl();

      const sendChunk = async (chunk) => {
        await sendChunkWithRetry({
          backendUrl,
          jobId,
          token,
          signal,
          chunk,
          index: chunkIndex,
          totalChunks,
        });
        chunkIndex += 1;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const combined = new Uint8Array(pending.length + value.length);
        combined.set(pending);
        combined.set(value, pending.length);
        pending = combined;

        while (pending.length >= chunkBytes) {
          const chunk = pending.slice(0, chunkBytes);
          pending = pending.slice(chunkBytes);
          await sendChunk(chunk);
          uploadedBytes += chunk.length;
          if (totalBytes) {
            const percent = Math.round((uploadedBytes / totalBytes) * 100);
            if (onProgress) {
              onProgress({ percent });
            }
          } else if (onProgress && chunkIndex % 5 === 0) {
            onProgress({ message: `Uploaded ${chunkIndex} chunks` });
          }
        }
      }

      if (pending.length > 0) {
        await sendChunk(pending);
        uploadedBytes += pending.length;
        if (totalBytes && onProgress) {
          const percent = Math.round((uploadedBytes / totalBytes) * 100);
          onProgress({ percent });
        }
      }

      return {
        chunkCount: chunkIndex,
        totalChunks,
        totalBytes,
      };
    }

    async function uploadMediaInChunks({
      jobId,
      mediaUrl,
      token,
      signal,
      onProgress,
      tabId,
      requestId,
    }) {
      let response;
      try {
        response = await fetchDirectMediaResponse(mediaUrl, signal);
      } catch (error) {
        if (shouldFallbackToContentScript(error) && tabId) {
          log.info('Trying content script fallback for media fetch');
          try {
            return await uploadViaContentScript({
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
            throw errors.createErrorWithCode(
              contentError?.message || 'Media could not be fetched via content script.',
              contentError?.code || 'CONTENT_FETCH_ERROR',
            );
          }
        }

        if (error?.name === 'AbortError') throw error;
        if (error?.code) throw error;

        throw errors.createErrorWithCode(
          'Media could not be fetched due to browser restrictions (CORS/opaque response) or network errors.',
          'NOT_AVAILABLE',
        );
      }

      return streamAndUploadResponse({
        response,
        jobId,
        token,
        signal,
        onProgress,
      });
    }

    return {
      uploadMediaInChunks,
    };
  }

  transcripts.aiTranscriptionUpload = {
    createAiTranscriptionUploadService,
  };
})();
