(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createPollingValidators(validators) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    return {
      validateJobResponse:
        runtimeValidators?.validateTranscriptJobResponse ||
        ((value) => ({ ok: true, value: value || { success: false } })),
      validateJob:
        runtimeValidators?.validateTranscriptJob || ((value) => ({ ok: true, value: value || {} })),
    };
  }

  async function fetchJobStatus({
    config,
    fetchJsonWithAuth,
    validateJobResponse,
    validateJob,
    jobId,
    token,
    signal,
  }) {
    const backendUrl = config.getBackendUrl();
    const data = await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}`, token, {
      method: 'GET',
      signal,
    });
    const parsed = validateJobResponse(data);
    if (parsed.ok && parsed.value?.job) {
      return parsed.value.job;
    }

    const jobParsed = validateJob(data);
    if (jobParsed.ok) {
      return jobParsed.value;
    }

    throw new Error(parsed.error || jobParsed.error || 'Invalid transcript job status response');
  }

  function resolveJobState(job) {
    if (!job) return { status: 'unknown' };
    if ((job.status === 'done' || job.status === 'completed') && job.transcript) {
      return { status: 'done', transcript: job.transcript };
    }
    if (job.status === 'error' || job.status === 'failed') {
      const errorMsg =
        typeof job.error === 'string' ? job.error : job.error?.message || 'AI transcription failed';
      return { status: 'error', error: errorMsg };
    }
    if (job.status === 'canceled') {
      return { status: 'canceled' };
    }
    return { status: 'processing' };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pollTranscriptJob({
    fetchJobStatusFn,
    pollIntervalMs,
    pollMaxAttempts,
    jobId,
    token,
    signal,
    onProgress,
  }) {
    for (let attempt = 0; attempt < pollMaxAttempts; attempt += 1) {
      if (signal?.aborted) {
        throw new Error('CANCELED');
      }

      const state = resolveJobState(await fetchJobStatusFn({ jobId, token, signal }));
      if (state.status === 'done') return state.transcript;
      if (state.status === 'error') throw new Error(state.error || 'AI transcription failed');
      if (state.status === 'canceled') throw new Error('CANCELED');

      if (onProgress) {
        onProgress({ message: 'Transcribing...' });
      }
      await wait(pollIntervalMs);
    }

    throw new Error('AI transcription timed out');
  }

  function createAiTranscriptionPollingService({
    config,
    fetchJsonWithAuth,
    pollIntervalMs,
    pollMaxAttempts,
    validators,
  }) {
    const validatorSet = createPollingValidators(validators);
    const fetchJobStatusFn = ({ jobId, token, signal }) =>
      fetchJobStatus({
        config,
        fetchJsonWithAuth,
        validateJobResponse: validatorSet.validateJobResponse,
        validateJob: validatorSet.validateJob,
        jobId,
        token,
        signal,
      });

    return {
      pollTranscriptJob: ({ jobId, token, signal, onProgress }) =>
        pollTranscriptJob({
          fetchJobStatusFn,
          pollIntervalMs,
          pollMaxAttempts,
          jobId,
          token,
          signal,
          onProgress,
        }),
    };
  }

  transcripts.aiTranscriptionPolling = {
    createAiTranscriptionPollingService,
  };
})();
