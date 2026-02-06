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
    const helpersFactory = transcripts.aiTranscriptionHelpers?.createAiTranscriptionHelpers || null;
    const requestsFactory =
      transcripts.aiTranscriptionRequests?.createAiTranscriptionRequests || null;
    const uploadServiceFactory =
      transcripts.aiTranscriptionUpload?.createAiTranscriptionUploadService;
    const pollingServiceFactory =
      transcripts.aiTranscriptionPolling?.createAiTranscriptionPollingService;
    const helpers =
      helpersFactory?.({
        aiUtils,
        auth,
        errors,
        log,
        chromeClient,
        chunkBytes: AI_UPLOAD_CHUNK_BYTES,
      }) || null;
    const requests = requestsFactory?.({ config, networkUtils, aiUtils }) || null;
    const uploadService =
      uploadServiceFactory?.({
        config,
        aiUtils,
        errors,
        contentScriptMedia,
        log,
        chunkBytes: AI_UPLOAD_CHUNK_BYTES,
        networkUtils,
      }) || null;
    const pollingService =
      requests && pollingServiceFactory
        ? pollingServiceFactory({
            config,
            fetchJsonWithAuth: requests.fetchJsonWithAuth,
            pollIntervalMs: AI_POLL_INTERVAL_MS,
            pollMaxAttempts: AI_POLL_MAX_ATTEMPTS,
          })
        : null;

    function requireHelpers() {
      if (!helpers) {
        throw errors.createErrorWithCode('AI transcription helpers unavailable.', 'NOT_AVAILABLE');
      }
      return helpers;
    }
    function requireRequests() {
      if (!requests) {
        throw errors.createErrorWithCode('AI transcription requests unavailable.', 'NOT_AVAILABLE');
      }
      return requests;
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

    function createJobState(requestId) {
      return {
        requestId,
        jobId: null,
        abortController: new AbortController(),
      };
    }

    async function prepareJobInputs({ video, signal }) {
      const helper = requireHelpers();
      const request = requireRequests();

      helper.ensureVideoEligible(video);
      const token = await helper.requireAuthToken();
      const mediaUrlNormalized = aiUtils.normalizeMediaUrl
        ? aiUtils.normalizeMediaUrl(video.mediaUrl)
        : video.mediaUrl;
      const headInfo = await request.fetchMediaHeadMetadata(video.mediaUrl, signal);
      if (headInfo?.authRequired) {
        throw errors.createErrorWithCode(
          'Authentication required to access this media.',
          'AUTH_REQUIRED',
        );
      }
      const expectedTotalChunks = helper.resolveExpectedTotalChunks(headInfo);
      const fingerprint = await helper.buildFingerprint({
        mediaUrlNormalized,
        headInfo,
        durationMs: video.durationMs || null,
      });
      return { token, mediaUrlNormalized, expectedTotalChunks, fingerprint };
    }

    function buildJobPayload({ video, fingerprint, mediaUrlNormalized, expectedTotalChunks }) {
      return {
        fingerprint,
        mediaUrl: video.mediaUrl,
        mediaUrlNormalized,
        durationMs: video.durationMs || null,
        provider: video.provider || 'unknown',
        expectedTotalChunks,
      };
    }

    async function uploadAndFinalize({
      jobId,
      video,
      token,
      options,
      expectedTotalChunks,
      progress,
      signal,
      tabId,
      requestId,
    }) {
      progress('uploading', { jobId, message: 'Uploading media...' });
      const uploadStats = await requireUploadService().uploadMediaInChunks({
        jobId,
        mediaUrl: video.mediaUrl,
        token,
        signal,
        onProgress: (info) => progress('uploading', { jobId, ...info }),
        tabId,
        requestId,
      });
      progress('processing', { jobId, message: 'Processing audio...' });
      const helper = requireHelpers();
      const expectedTotalChunksForFinalize = helper.resolveFinalizeChunkCount(
        uploadStats,
        expectedTotalChunks,
      );
      await requireRequests().finalizeTranscriptionJob({
        jobId,
        token,
        options,
        expectedTotalChunks: expectedTotalChunksForFinalize,
        signal,
      });
    }

    async function pollForTranscript({ jobId, token, progress, signal }) {
      progress('polling', { jobId, message: 'Transcribing...' });
      return requirePollingService().pollTranscriptJob({
        jobId,
        token,
        signal,
        onProgress: (info) => progress('polling', { jobId, ...info }),
      });
    }
    async function runAiTranscriptionFlow({ video, options, progress, jobState }) {
      const helper = requireHelpers();
      const request = requireRequests();
      const { token, mediaUrlNormalized, expectedTotalChunks, fingerprint } =
        await prepareJobInputs({
          video,
          signal: jobState.abortController.signal,
        });

      const jobResponse = await request.createTranscriptionJob({
        token,
        payload: buildJobPayload({
          video,
          fingerprint,
          mediaUrlNormalized,
          expectedTotalChunks,
        }),
        signal: jobState.abortController.signal,
      });

      if (jobResponse?.job?.transcript) {
        progress('completed', { message: 'Transcript ready.' });
        return helper.buildSuccessResponse({
          requestId: jobState.requestId,
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
      await uploadAndFinalize({
        jobId,
        video,
        token,
        options,
        expectedTotalChunks,
        progress,
        signal: jobState.abortController.signal,
        tabId: jobState.tabId,
        requestId: jobState.requestId,
      });

      const transcript = await pollForTranscript({
        jobId,
        token,
        progress,
        signal: jobState.abortController.signal,
      });

      progress('completed', { jobId, message: 'Transcript ready.' });
      return helper.buildSuccessResponse({
        requestId: jobState.requestId,
        jobId,
        transcript,
      });
    }

    async function handleAiTranscriptionStart(payload, sender) {
      const helper = requireHelpers();
      const { video, options, requestId, tabId } = helper.buildRequestContext(payload, sender);

      if (!video || !video.mediaUrl) {
        return helper.buildFailureResponse({
          requestId,
          error: 'Media URL not available for AI transcription.',
          errorCode: 'NOT_AVAILABLE',
        });
      }

      const progress = helper.createProgressEmitter(tabId, requestId);
      const jobState = { ...createJobState(requestId), tabId };
      jobs.set(requestId, jobState);
      progress('starting', { message: 'Preparing AI transcription...' });

      try {
        return await runAiTranscriptionFlow({ video, options, progress, jobState });
      } catch (error) {
        const failure = helper.resolveFailureResponse({ error, jobState, requestId });
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
        try {
          await requireRequests().cancelTranscriptJob({ jobId, token });
        } catch (error) {
          log.warn('Failed to cancel transcript job:', error);
        }
      }

      return { success: true, requestId, jobId };
    }

    return {
      handleAiTranscriptionStart,
      handleAiTranscriptionCancel,
      listActiveTranscriptJobs: (args) => requireRequests().listActiveTranscriptJobs(args),
      cancelAllActiveTranscriptJobs: (args) =>
        requireRequests().cancelAllActiveTranscriptJobs(args),
    };
  }

  transcripts.aiTranscription = {
    createAiTranscriptionService,
  };
})();
