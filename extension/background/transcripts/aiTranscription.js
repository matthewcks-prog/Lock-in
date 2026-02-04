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
    const uploadServiceFactory =
      transcripts.aiTranscriptionUpload?.createAiTranscriptionUploadService;
    const pollingServiceFactory =
      transcripts.aiTranscriptionPolling?.createAiTranscriptionPollingService;
    let uploadService = null;
    let pollingService = null;

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

    uploadService =
      uploadServiceFactory?.({
        config,
        aiUtils,
        errors,
        contentScriptMedia,
        log,
        chunkBytes: AI_UPLOAD_CHUNK_BYTES,
      }) || null;
    pollingService =
      pollingServiceFactory?.({
        config,
        fetchJsonWithAuth,
        pollIntervalMs: AI_POLL_INTERVAL_MS,
        pollMaxAttempts: AI_POLL_MAX_ATTEMPTS,
      }) || null;

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
        if (typeof fetchWithRetry !== 'function') {
          throw new Error('Network utilities unavailable');
        }
        const response = await fetchWithRetry(mediaUrl, {
          method: 'HEAD',
          credentials: 'include',
          signal,
        });

        if (aiUtils.isAuthStatus?.(response.status)) {
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

    function buildFailureResponse({ requestId, jobId, error, errorCode, status }) {
      return {
        success: false,
        error: error || 'Failed to transcribe media.',
        errorCode: errorCode || 'NOT_AVAILABLE',
        jobId,
        status: status || 'failed',
        requestId,
      };
    }

    function buildSuccessResponse({ requestId, jobId, transcript, cached }) {
      return {
        success: true,
        transcript,
        jobId,
        status: 'completed',
        cached: Boolean(cached),
        requestId,
      };
    }

    function buildRequestContext(payload, sender) {
      return {
        video: payload?.video || null,
        options: payload?.options || {},
        requestId: payload?.requestId || `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        tabId: sender?.tab?.id || null,
      };
    }

    function ensureVideoEligible(video) {
      if (aiUtils.isBlobUrl?.(video.mediaUrl)) {
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
    }

    async function requireAuthToken() {
      const token = await auth.getAuthToken();
      if (!token) {
        throw errors.createErrorWithCode(
          'Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.',
          'LOCKIN_AUTH_REQUIRED',
        );
      }
      return token;
    }

    function resolveExpectedTotalChunks(headInfo) {
      const headContentLength = headInfo?.contentLength ? Number(headInfo.contentLength) : null;
      return Number.isFinite(headContentLength) && headContentLength > 0
        ? Math.ceil(headContentLength / AI_UPLOAD_CHUNK_BYTES)
        : null;
    }

    function buildFingerprintSource({ mediaUrlNormalized, headInfo, durationMs }) {
      return [
        mediaUrlNormalized,
        headInfo?.etag || '',
        headInfo?.lastModified || '',
        headInfo?.contentLength || '',
        durationMs || '',
      ].join('|');
    }

    async function buildFingerprint({ mediaUrlNormalized, headInfo, durationMs }) {
      const source = buildFingerprintSource({ mediaUrlNormalized, headInfo, durationMs });
      if (typeof aiUtils.hashStringSha256 !== 'function') {
        return source;
      }
      return aiUtils.hashStringSha256(source);
    }

    function resolveFinalizeChunkCount(uploadStats, expectedTotalChunks) {
      return uploadStats?.totalChunks || expectedTotalChunks || uploadStats?.chunkCount || null;
    }

    function requireUploadService() {
      if (!uploadService) {
        throw errors.createErrorWithCode('Upload service unavailable.', 'NOT_AVAILABLE');
      }
      return uploadService;
    }

    function requirePollingService() {
      if (!pollingService) {
        throw errors.createErrorWithCode('Polling service unavailable.', 'NOT_AVAILABLE');
      }
      return pollingService;
    }

    function resolveFailureResponse({ error, jobState, requestId }) {
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = errors.getErrorCode(error);
      const status = error?.status;

      if (jobState.abortController.signal.aborted || message === 'CANCELED') {
        return {
          progress: { stage: 'canceled', message: 'Canceled.' },
          response: buildFailureResponse({
            requestId,
            jobId: jobState.jobId,
            error: 'Transcription canceled.',
            errorCode: 'CANCELED',
            status: 'canceled',
          }),
        };
      }

      if (errorCode === 'LOCKIN_AUTH_REQUIRED') {
        return {
          progress: { stage: 'failed', message: 'Lock-in sign-in required.' },
          response: buildFailureResponse({
            requestId,
            jobId: jobState.jobId,
            error:
              'Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.',
            errorCode: 'LOCKIN_AUTH_REQUIRED',
            status: 'failed',
          }),
        };
      }

      if (
        errorCode === 'AUTH_REQUIRED' ||
        message === 'AUTH_REQUIRED' ||
        aiUtils.isAuthStatus?.(status)
      ) {
        return {
          progress: { stage: 'failed', message: 'Media authentication required.' },
          response: buildFailureResponse({
            requestId,
            jobId: jobState.jobId,
            error:
              'Media authentication required. Please refresh the page and ensure you are logged in to the learning platform.',
            errorCode: 'AUTH_REQUIRED',
            status: 'failed',
          }),
        };
      }

      return {
        progress: { stage: 'failed', message },
        response: buildFailureResponse({
          requestId,
          jobId: jobState.jobId,
          error: message || 'Failed to transcribe media.',
          errorCode: errorCode || 'NOT_AVAILABLE',
          status: 'failed',
        }),
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
      const { video, options, requestId, tabId } = buildRequestContext(payload, sender);

      if (!video || !video.mediaUrl) {
        return buildFailureResponse({
          requestId,
          error: 'Media URL not available for AI transcription.',
          errorCode: 'NOT_AVAILABLE',
        });
      }

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
        ensureVideoEligible(video);

        const token = await requireAuthToken();
        const mediaUrlNormalized = aiUtils.normalizeMediaUrl
          ? aiUtils.normalizeMediaUrl(video.mediaUrl)
          : video.mediaUrl;
        const headInfo = await fetchMediaHeadMetadata(video.mediaUrl, abortController.signal);
        if (headInfo?.authRequired) {
          throw errors.createErrorWithCode(
            'Authentication required to access this media.',
            'AUTH_REQUIRED',
          );
        }

        const expectedTotalChunks = resolveExpectedTotalChunks(headInfo);
        const fingerprint = await buildFingerprint({
          mediaUrlNormalized,
          headInfo,
          durationMs: video.durationMs || null,
        });

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
          return buildSuccessResponse({
            requestId,
            jobId: jobResponse.job.id,
            transcript: jobResponse.job.transcript,
            cached: true,
          });
        }

        const jobId = jobResponse?.job?.id || jobResponse?.jobId;
        if (!jobId) {
          throw new Error('Failed to create transcription job');
        }

        jobState.jobId = jobId;
        progress('uploading', { jobId, message: 'Uploading media...' });

        const uploadStats = await requireUploadService().uploadMediaInChunks({
          jobId,
          mediaUrl: video.mediaUrl,
          token,
          signal: abortController.signal,
          onProgress: (info) => progress('uploading', { jobId, ...info }),
          tabId,
          requestId,
        });

        progress('processing', { jobId, message: 'Processing audio...' });
        const expectedTotalChunksForFinalize = resolveFinalizeChunkCount(
          uploadStats,
          expectedTotalChunks,
        );
        await finalizeTranscriptionJob({
          jobId,
          token,
          options,
          expectedTotalChunks: expectedTotalChunksForFinalize,
          signal: abortController.signal,
        });

        progress('polling', { jobId, message: 'Transcribing...' });
        const transcript = await requirePollingService().pollTranscriptJob({
          jobId,
          token,
          signal: abortController.signal,
          onProgress: (info) => progress('polling', { jobId, ...info }),
        });

        progress('completed', { jobId, message: 'Transcript ready.' });
        return buildSuccessResponse({
          requestId,
          jobId,
          transcript,
        });
      } catch (error) {
        const failure = resolveFailureResponse({ error, jobState, requestId });
        progress(failure.progress.stage, {
          jobId: jobState.jobId,
          message: failure.progress.message,
        });
        return failure.response;
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
