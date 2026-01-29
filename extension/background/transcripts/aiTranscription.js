(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createAiTranscriptionService({
    config,
    auth,
    networkUtils,
    chromeClient,
    errors,
    contentScriptMedia,
    log,
  }) {
    const AI_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
    const AI_POLL_INTERVAL_MS = 3000;
    const AI_POLL_MAX_ATTEMPTS = 160;

    const jobs = new Map();
    const aiUtils = transcripts.aiUtils || {};
    const fetchWithRetry = networkUtils?.fetchWithRetry;

    function createProgressEmitter(tabId, requestId) {
      let lastStage = null;
      let lastPercentBucket = null;

      return (stage, info = {}) => {
        if (!tabId) return;

        const percent =
          typeof info.percent === 'number' ? Math.max(0, Math.min(100, info.percent)) : undefined;
        const percentBucket = typeof percent === 'number' ? Math.floor(percent) : null;
        const shouldSkip =
          stage === lastStage &&
          percentBucket !== null &&
          percentBucket === lastPercentBucket &&
          !info.message;

        if (shouldSkip) return;

        lastStage = stage;
        if (percentBucket !== null) {
          lastPercentBucket = percentBucket;
        }

        try {
          Promise.resolve(
            chromeClient.sendTabMessage(tabId, {
              type: 'TRANSCRIBE_MEDIA_AI_PROGRESS',
              payload: {
                requestId,
                jobId: info.jobId || null,
                stage,
                message: info.message || null,
                percent,
              },
            }),
          ).catch((error) => {
            log.warn('Failed to send progress update:', error);
          });
        } catch (error) {
          log.warn('Failed to send progress update:', error);
        }
      };
    }

    async function fetchJsonWithAuth(url, token, options = {}) {
      const headers = Object.assign({}, options.headers || {}, {
        Authorization: `Bearer ${token}`,
      });

      const response = await fetch(url, { ...options, headers });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        let message = 'Request failed';
        if (data?.error?.message) {
          message = data.error.message;
        } else if (typeof data?.error === 'string') {
          message = data.error;
        } else if (typeof data?.message === 'string') {
          message = data.message;
        } else if (response.statusText) {
          message = response.statusText;
        }
        const error = new Error(message);
        if (data?.error?.code) {
          error.code = data.error.code;
        }
        if (data?.error?.details) {
          error.details = data.error.details;
        }
        error.status = response.status;
        throw error;
      }

      return data;
    }

    async function createTranscriptionJob({ token, payload, signal }) {
      const backendUrl = config.getBackendUrl();
      return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
    }

    async function fetchMediaHeadMetadata(mediaUrl, signal) {
      try {
        const response = await fetchWithRetry(mediaUrl, {
          method: 'HEAD',
          credentials: 'include',
          signal,
        });

        if (aiUtils.isAuthStatus(response.status)) {
          return { authRequired: true };
        }

        if (!response.ok) {
          return { ok: false, status: response.status };
        }

        if (response.type === 'opaque') {
          return { ok: false, opaque: true };
        }

        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        const contentLength = response.headers.get('content-length');
        return {
          ok: true,
          etag: etag ? etag.trim() : '',
          lastModified: lastModified ? lastModified.trim() : '',
          contentLength: contentLength ? contentLength.trim() : '',
        };
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      }
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
      const backendUrl = config.getBackendUrl();
      let uploadedBytes = 0;
      let chunkIndex = 0;

      const sendChunkToBackend = async (chunk, index, maxRetries = 5) => {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'x-chunk-index': String(index),
        };

        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
          if (signal?.aborted) {
            throw new Error('CANCELED');
          }

          const response = await fetch(`${backendUrl}/api/transcripts/jobs/${jobId}/chunks`, {
            method: 'PUT',
            headers,
            body: chunk,
            signal,
          });

          if (response.ok) {
            return response.json();
          }

          if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');
            let retryAfterMs;

            if (retryAfterHeader) {
              retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
            } else {
              retryAfterMs = Math.min(2000 * Math.pow(2, attempt), 32000);
            }

            log.info(
              `Rate limited on chunk ${index}, retrying in ${retryAfterMs}ms (attempt ${
                attempt + 1
              }/${maxRetries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
            continue;
          }

          const text = await response.text();
          let data = null;
          try {
            data = JSON.parse(text);
          } catch {
            /* ignore */
          }
          lastError = new Error(
            data?.error?.message || data?.error || `Chunk upload failed: ${response.status}`,
          );
          break;
        }

        throw lastError || new Error(`Chunk ${index} upload failed after ${maxRetries} retries`);
      };

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

      let response;

      try {
        log.info('Attempting direct media fetch:', mediaUrl);

        response = await fetch(mediaUrl, {
          method: 'GET',
          credentials: 'include',
          redirect: 'manual',
          signal,
        });

        log.info('Initial response:', response.status, response.type);

        if (
          response.type === 'opaqueredirect' ||
          response.status === 0 ||
          (response.status >= 300 && response.status < 400)
        ) {
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

            response = await fetch(location, {
              method: 'GET',
              credentials: useCredentials ? 'include' : 'omit',
              signal,
            });
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
          if (aiUtils.isAuthStatus(response.status)) {
            throw errors.createErrorWithCode(
              'Authentication required. Please refresh the page and log in.',
              'AUTH_REQUIRED',
            );
          }
          throw errors.createErrorWithCode(`HTTP ${response.status}`, 'FETCH_ERROR');
        }

        log.info('Direct fetch successful');
      } catch (error) {
        const shouldFallback =
          error?.code === 'CORS_BLOCKED' ||
          error?.code === 'NOT_AVAILABLE' ||
          (error?.message &&
            (error.message.includes('CORS') ||
              error.message.includes('opaque') ||
              error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError')));

        if (shouldFallback && tabId) {
          log.info('Trying content script fallback for media fetch');

          try {
            await contentScriptMedia.fetchMediaViaContentScript({
              tabId,
              mediaUrl,
              jobId,
              requestId,
              onChunk: async (chunkBytes, index, isLast) => {
                await sendChunkToBackend(chunkBytes, index);
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

      if (!response.body || typeof response.body.getReader !== 'function') {
        throw errors.createErrorWithCode(
          'Streaming not supported for this media.',
          'NOT_AVAILABLE',
        );
      }

      const totalBytesHeader = response.headers.get('content-length');
      const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
      const totalChunks =
        Number.isFinite(totalBytes) && totalBytes > 0
          ? Math.ceil(totalBytes / AI_UPLOAD_CHUNK_BYTES)
          : null;

      const reader = response.body.getReader();
      let pending = new Uint8Array(0);

      const sendChunk = async (chunk, maxRetries = 5) => {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'x-chunk-index': String(chunkIndex),
        };
        if (totalChunks) {
          headers['x-total-chunks'] = String(totalChunks);
        }

        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
          if (signal?.aborted) {
            throw new Error('CANCELED');
          }

          const uploadResponse = await fetch(`${backendUrl}/api/transcripts/jobs/${jobId}/chunks`, {
            method: 'PUT',
            headers,
            body: chunk,
            signal,
          });

          if (uploadResponse.ok) {
            chunkIndex += 1;
            return;
          }

          if (uploadResponse.status === 429) {
            const retryAfterHeader = uploadResponse.headers.get('Retry-After');
            let retryAfterMs;

            if (retryAfterHeader) {
              retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
            } else {
              retryAfterMs = Math.min(2000 * Math.pow(2, attempt), 32000);
            }

            log.info(
              `Rate limited on chunk ${chunkIndex}, retrying in ${retryAfterMs}ms (attempt ${
                attempt + 1
              }/${maxRetries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
            continue;
          }

          const text = await uploadResponse.text();
          let data = null;
          try {
            data = JSON.parse(text);
          } catch {
            /* ignore */
          }
          lastError = new Error(
            data?.error?.message ||
              data?.error ||
              `Failed to upload chunk ${chunkIndex}: ${uploadResponse.status}`,
          );
          break;
        }

        throw (
          lastError || new Error(`Chunk ${chunkIndex} upload failed after ${maxRetries} retries`)
        );
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const combined = new Uint8Array(pending.length + value.length);
        combined.set(pending);
        combined.set(value, pending.length);
        pending = combined;

        while (pending.length >= AI_UPLOAD_CHUNK_BYTES) {
          const chunk = pending.slice(0, AI_UPLOAD_CHUNK_BYTES);
          pending = pending.slice(AI_UPLOAD_CHUNK_BYTES);
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

    async function finalizeTranscriptionJob({
      jobId,
      token,
      options,
      expectedTotalChunks,
      signal,
    }) {
      const backendUrl = config.getBackendUrl();
      const payload = Object.assign({}, options || {});
      if (expectedTotalChunks) {
        payload.expectedTotalChunks = expectedTotalChunks;
      }
      return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}/finalize`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
    }

    async function pollTranscriptJob({ jobId, token, signal, onProgress }) {
      const backendUrl = config.getBackendUrl();
      for (let attempt = 0; attempt < AI_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (signal?.aborted) {
          throw new Error('CANCELED');
        }

        const data = await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}`, token, {
          method: 'GET',
          signal,
        });

        const job = data?.job || data;
        if ((job?.status === 'done' || job?.status === 'completed') && job.transcript) {
          return job.transcript;
        }
        if (job?.status === 'error' || job?.status === 'failed') {
          const errorMsg =
            typeof job.error === 'string'
              ? job.error
              : job.error?.message || 'AI transcription failed';
          throw new Error(errorMsg);
        }
        if (job?.status === 'canceled') {
          throw new Error('CANCELED');
        }

        if (onProgress) {
          onProgress({ message: 'Transcribing...' });
        }
        await new Promise((resolve) => setTimeout(resolve, AI_POLL_INTERVAL_MS));
      }

      throw new Error('AI transcription timed out');
    }

    async function cancelTranscriptJob({ jobId, token }) {
      if (!jobId || !token) return;
      const backendUrl = config.getBackendUrl();
      try {
        await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}/cancel`, token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch (error) {
        log.warn('Failed to cancel transcript job:', error);
      }
    }

    async function listActiveTranscriptJobs({ token }) {
      if (!token) throw new Error('No auth token provided');
      const backendUrl = config.getBackendUrl();
      return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/active`, token, {
        method: 'GET',
      });
    }

    async function cancelAllActiveTranscriptJobs({ token }) {
      if (!token) throw new Error('No auth token provided');
      const backendUrl = config.getBackendUrl();
      return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/cancel-all`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }

    async function handleAiTranscriptionStart(payload, sender) {
      const video = payload?.video;
      const options = payload?.options || {};
      const requestId =
        payload?.requestId || `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      if (!video || !video.mediaUrl) {
        return {
          success: false,
          error: 'Media URL not available for AI transcription.',
          errorCode: 'NOT_AVAILABLE',
          requestId,
        };
      }

      const tabId = sender?.tab?.id || null;
      const progress = createProgressEmitter(tabId, requestId);
      const abortController = new AbortController();

      const jobState = {
        requestId,
        jobId: null,
        abortController,
      };

      jobs.set(requestId, jobState);
      progress('starting', { message: 'Preparing AI transcription...' });

      try {
        if (aiUtils.isBlobUrl(video.mediaUrl)) {
          throw errors.createErrorWithCode(
            'This video uses a blob URL and cannot be accessed for AI transcription.',
            'NOT_AVAILABLE',
          );
        }

        if (video.drmDetected) {
          const reason = video.drmReason ? ` (${video.drmReason})` : '';
          throw errors.createErrorWithCode(
            `This video appears to be DRM-protected${reason}. AI transcription is not available.`,
            'NOT_AVAILABLE',
          );
        }

        const token = await auth.getAuthToken();
        if (!token) {
          throw errors.createErrorWithCode(
            'Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.',
            'LOCKIN_AUTH_REQUIRED',
          );
        }

        const mediaUrlNormalized = aiUtils.normalizeMediaUrl(video.mediaUrl);
        const headInfo = await fetchMediaHeadMetadata(video.mediaUrl, abortController.signal);
        if (headInfo?.authRequired) {
          throw errors.createErrorWithCode(
            'Authentication required to access this media.',
            'AUTH_REQUIRED',
          );
        }

        const headContentLength = headInfo?.contentLength ? Number(headInfo.contentLength) : null;
        const expectedTotalChunks =
          Number.isFinite(headContentLength) && headContentLength > 0
            ? Math.ceil(headContentLength / AI_UPLOAD_CHUNK_BYTES)
            : null;

        const fingerprintSource = [
          mediaUrlNormalized,
          headInfo?.etag || '',
          headInfo?.lastModified || '',
          headInfo?.contentLength || '',
          video.durationMs || '',
        ].join('|');
        const fingerprint = await aiUtils.hashStringSha256(fingerprintSource);

        const jobResponse = await createTranscriptionJob({
          token,
          payload: {
            fingerprint,
            mediaUrl: video.mediaUrl,
            mediaUrlNormalized,
            durationMs: video.durationMs || null,
            provider: video.provider || 'unknown',
            expectedTotalChunks,
          },
          signal: abortController.signal,
        });

        if (jobResponse?.job?.transcript) {
          progress('completed', { message: 'Transcript ready.' });
          return {
            success: true,
            transcript: jobResponse.job.transcript,
            jobId: jobResponse.job.id,
            status: 'completed',
            cached: true,
            requestId,
          };
        }

        const jobId = jobResponse?.job?.id || jobResponse?.jobId;
        if (!jobId) {
          throw new Error('Failed to create transcription job');
        }

        jobState.jobId = jobId;
        progress('uploading', { jobId, message: 'Uploading media...' });

        const uploadStats = await uploadMediaInChunks({
          jobId,
          mediaUrl: video.mediaUrl,
          token,
          signal: abortController.signal,
          onProgress: (info) => progress('uploading', { jobId, ...info }),
          tabId,
          requestId,
        });

        progress('processing', { jobId, message: 'Processing audio...' });
        const expectedTotalChunksForFinalize =
          uploadStats?.totalChunks || expectedTotalChunks || uploadStats?.chunkCount || null;
        await finalizeTranscriptionJob({
          jobId,
          token,
          options,
          expectedTotalChunks: expectedTotalChunksForFinalize,
          signal: abortController.signal,
        });

        progress('polling', { jobId, message: 'Transcribing...' });
        const transcript = await pollTranscriptJob({
          jobId,
          token,
          signal: abortController.signal,
          onProgress: (info) => progress('polling', { jobId, ...info }),
        });

        progress('completed', { jobId, message: 'Transcript ready.' });
        return {
          success: true,
          transcript,
          jobId,
          status: 'completed',
          requestId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorCode = errors.getErrorCode(error);
        const status = error?.status;
        if (abortController.signal.aborted || message === 'CANCELED') {
          progress('canceled', { jobId: jobState.jobId, message: 'Canceled.' });
          return {
            success: false,
            error: 'Transcription canceled.',
            errorCode: 'CANCELED',
            jobId: jobState.jobId,
            status: 'canceled',
            requestId,
          };
        }
        if (errorCode === 'LOCKIN_AUTH_REQUIRED') {
          progress('failed', {
            jobId: jobState.jobId,
            message: 'Lock-in sign-in required.',
          });
          return {
            success: false,
            error:
              'Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.',
            errorCode: 'LOCKIN_AUTH_REQUIRED',
            jobId: jobState.jobId,
            status: 'failed',
            requestId,
          };
        }
        if (
          errorCode === 'AUTH_REQUIRED' ||
          message === 'AUTH_REQUIRED' ||
          aiUtils.isAuthStatus(status)
        ) {
          progress('failed', {
            jobId: jobState.jobId,
            message: 'Media authentication required.',
          });
          return {
            success: false,
            error:
              'Media authentication required. Please refresh the page and ensure you are logged in to the learning platform.',
            errorCode: 'AUTH_REQUIRED',
            jobId: jobState.jobId,
            status: 'failed',
            requestId,
          };
        }
        progress('failed', { jobId: jobState.jobId, message });
        return {
          success: false,
          error: message || 'Failed to transcribe media.',
          errorCode: errorCode || 'NOT_AVAILABLE',
          jobId: jobState.jobId,
          status: 'failed',
          requestId,
        };
      } finally {
        jobs.delete(requestId);
      }
    }

    async function handleAiTranscriptionCancel(payload) {
      const requestId = payload?.requestId;
      const jobId = payload?.jobId;

      const jobState = requestId ? jobs.get(requestId) : null;
      if (jobState?.abortController) {
        jobState.abortController.abort();
      }

      const token = await auth.getAuthToken();
      if (jobId && token) {
        await cancelTranscriptJob({ jobId, token });
      }

      return { success: true, requestId, jobId };
    }

    return {
      handleAiTranscriptionStart,
      handleAiTranscriptionCancel,
      listActiveTranscriptJobs,
      cancelAllActiveTranscriptJobs,
    };
  }

  transcripts.aiTranscription = {
    createAiTranscriptionService,
  };
})();
