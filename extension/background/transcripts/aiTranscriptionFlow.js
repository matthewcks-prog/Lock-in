(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createJobState({ requestId, tabId }) {
    return {
      requestId,
      tabId,
      jobId: null,
      abortController: new AbortController(),
    };
  }

  function normalizeMediaUrl(aiUtils, mediaUrl) {
    if (typeof aiUtils.normalizeMediaUrl !== 'function') {
      return mediaUrl;
    }
    return aiUtils.normalizeMediaUrl(mediaUrl);
  }

  async function prepareJobInputs({ accessors, aiUtils, errors, video, signal }) {
    const helper = accessors.requireHelpers();
    const request = accessors.requireRequests();
    helper.ensureVideoEligible(video);
    const token = await helper.requireAuthToken();
    const mediaUrlNormalized = normalizeMediaUrl(aiUtils, video.mediaUrl);
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
    accessors,
    video,
    token,
    options,
    expectedTotalChunks,
    progress,
    jobState,
  }) {
    progress('uploading', { jobId: jobState.jobId, message: 'Uploading media...' });
    const uploadStats = await accessors.requireUploadService().uploadMediaInChunks({
      jobId: jobState.jobId,
      mediaUrl: video.mediaUrl,
      token,
      signal: jobState.abortController.signal,
      onProgress: (info) => progress('uploading', { jobId: jobState.jobId, ...info }),
      tabId: jobState.tabId,
      requestId: jobState.requestId,
    });

    progress('processing', { jobId: jobState.jobId, message: 'Processing audio...' });
    const helper = accessors.requireHelpers();
    const expectedTotalChunksForFinalize = helper.resolveFinalizeChunkCount(
      uploadStats,
      expectedTotalChunks,
    );
    await accessors.requireRequests().finalizeTranscriptionJob({
      jobId: jobState.jobId,
      token,
      options,
      expectedTotalChunks: expectedTotalChunksForFinalize,
      signal: jobState.abortController.signal,
    });
  }

  async function pollForTranscript({ accessors, jobState, token, progress }) {
    progress('polling', { jobId: jobState.jobId, message: 'Transcribing...' });
    return accessors.requirePollingService().pollTranscriptJob({
      jobId: jobState.jobId,
      token,
      signal: jobState.abortController.signal,
      onProgress: (info) => progress('polling', { jobId: jobState.jobId, ...info }),
    });
  }

  function resolveJobId(jobResponse) {
    return jobResponse?.job?.id || jobResponse?.jobId || null;
  }

  function buildCachedTranscriptResponse({ helper, progress, requestId, jobResponse }) {
    progress('completed', { message: 'Transcript ready.' });
    return helper.buildSuccessResponse({
      requestId,
      jobId: jobResponse.job.id,
      transcript: jobResponse.job.transcript,
      cached: true,
    });
  }

  function assignJobIdOrThrow(jobState, jobResponse) {
    const jobId = resolveJobId(jobResponse);
    if (!jobId) throw new Error('Failed to create transcription job');
    jobState.jobId = jobId;
    return jobId;
  }

  async function createTranscriptionJob({ request, token, video, jobInputs, signal }) {
    return request.createTranscriptionJob({
      token,
      payload: buildJobPayload({
        video,
        fingerprint: jobInputs.fingerprint,
        mediaUrlNormalized: jobInputs.mediaUrlNormalized,
        expectedTotalChunks: jobInputs.expectedTotalChunks,
      }),
      signal,
    });
  }

  async function completeTranscriptionAndBuildResponse({
    helper,
    accessors,
    jobState,
    token,
    progress,
  }) {
    const transcript = await pollForTranscript({
      accessors,
      jobState,
      token,
      progress,
    });
    progress('completed', { jobId: jobState.jobId, message: 'Transcript ready.' });
    return helper.buildSuccessResponse({
      requestId: jobState.requestId,
      jobId: jobState.jobId,
      transcript,
    });
  }

  async function runAiTranscriptionFlow({
    accessors,
    aiUtils,
    errors,
    video,
    options,
    progress,
    jobState,
  }) {
    const helper = accessors.requireHelpers();
    const jobInputs = await prepareJobInputs({
      accessors,
      aiUtils,
      errors,
      video,
      signal: jobState.abortController.signal,
    });
    const jobResponse = await createTranscriptionJob({
      request: accessors.requireRequests(),
      token: jobInputs.token,
      video,
      jobInputs,
      signal: jobState.abortController.signal,
    });

    if (jobResponse?.job?.transcript) {
      return buildCachedTranscriptResponse({
        helper,
        progress,
        requestId: jobState.requestId,
        jobResponse,
      });
    }

    const jobId = assignJobIdOrThrow(jobState, jobResponse);
    await uploadAndFinalize({
      accessors,
      video,
      token: jobInputs.token,
      options,
      expectedTotalChunks: jobInputs.expectedTotalChunks,
      progress,
      jobState,
    });
    return completeTranscriptionAndBuildResponse({
      helper,
      accessors,
      jobState,
      token: jobInputs.token,
      progress,
    });
  }

  function createHandleAiTranscriptionStart({ accessors, aiUtils, errors, jobs }) {
    return async function handleAiTranscriptionStart(payload, sender) {
      const helper = accessors.requireHelpers();
      const { video, options, requestId, tabId } = helper.buildRequestContext(payload, sender);
      if (!video || !video.mediaUrl) {
        return helper.buildFailureResponse({
          requestId,
          error: 'Media URL not available for AI transcription.',
          errorCode: 'NOT_AVAILABLE',
        });
      }

      const progress = helper.createProgressEmitter(tabId, requestId);
      const jobState = createJobState({ requestId, tabId });
      jobs.set(requestId, jobState);
      progress('starting', { message: 'Preparing AI transcription...' });
      try {
        return await runAiTranscriptionFlow({
          accessors,
          aiUtils,
          errors,
          video,
          options,
          progress,
          jobState,
        });
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
    };
  }

  function createHandleAiTranscriptionCancel({ accessors, jobs, auth, log }) {
    return async function handleAiTranscriptionCancel(payload) {
      const requestId = payload?.requestId;
      const jobId = payload?.jobId;
      const jobState = requestId ? jobs.get(requestId) : null;
      if (jobState?.abortController) {
        jobState.abortController.abort();
      }

      const token = await auth.getAuthToken();
      if (jobId && token) {
        try {
          await accessors.requireRequests().cancelTranscriptJob({ jobId, token });
        } catch (error) {
          log.warn('Failed to cancel transcript job:', error);
        }
      }
      return { success: true, requestId, jobId };
    };
  }

  function createAiTranscriptionFlow({ accessors, aiUtils, errors, jobs, auth, log }) {
    return {
      handleAiTranscriptionStart: createHandleAiTranscriptionStart({
        accessors,
        aiUtils,
        errors,
        jobs,
      }),
      handleAiTranscriptionCancel: createHandleAiTranscriptionCancel({
        accessors,
        jobs,
        auth,
        log,
      }),
    };
  }

  transcripts.aiTranscriptionFlow = {
    createAiTranscriptionFlow,
  };
})();
