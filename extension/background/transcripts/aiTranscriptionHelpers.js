(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createAiTranscriptionHelpers({ aiUtils, auth, errors, log, chromeClient, chunkBytes }) {
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
        ? Math.ceil(headContentLength / chunkBytes)
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

    function resolveCanceledFailure({ jobState, requestId }) {
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

    function resolveLockInAuthFailure({ jobState, requestId }) {
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

    function resolveMediaAuthFailure({ jobState, requestId }) {
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

    function resolveGenericFailure({ jobState, requestId, message, errorCode }) {
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

    function resolveFailureResponse({ error, jobState, requestId }) {
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = errors.getErrorCode(error);
      const status = error?.status;

      if (jobState.abortController.signal.aborted || message === 'CANCELED') {
        return resolveCanceledFailure({ jobState, requestId });
      }

      if (errorCode === 'LOCKIN_AUTH_REQUIRED') {
        return resolveLockInAuthFailure({ jobState, requestId });
      }

      if (
        errorCode === 'AUTH_REQUIRED' ||
        message === 'AUTH_REQUIRED' ||
        aiUtils.isAuthStatus?.(status)
      ) {
        return resolveMediaAuthFailure({ jobState, requestId });
      }

      return resolveGenericFailure({ jobState, requestId, message, errorCode });
    }

    return {
      createProgressEmitter,
      buildRequestContext,
      ensureVideoEligible,
      requireAuthToken,
      resolveExpectedTotalChunks,
      buildFingerprint,
      resolveFinalizeChunkCount,
      buildFailureResponse,
      buildSuccessResponse,
      resolveFailureResponse,
    };
  }

  transcripts.aiTranscriptionHelpers = {
    createAiTranscriptionHelpers,
  };
})();
