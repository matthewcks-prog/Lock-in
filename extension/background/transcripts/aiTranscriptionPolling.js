(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createAiTranscriptionPollingService({
    config,
    fetchJsonWithAuth,
    pollIntervalMs,
    pollMaxAttempts,
    validators,
  }) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    const validateJobResponse =
      runtimeValidators?.validateTranscriptJobResponse ||
      ((value) => ({ ok: true, value: value || { success: false } }));
    const validateJob =
      runtimeValidators?.validateTranscriptJob || ((value) => ({ ok: true, value: value || {} }));

    async function fetchJobStatus({ jobId, token, signal }) {
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
          typeof job.error === 'string'
            ? job.error
            : job.error?.message || 'AI transcription failed';
        return { status: 'error', error: errorMsg };
      }
      if (job.status === 'canceled') {
        return { status: 'canceled' };
      }
      return { status: 'processing' };
    }

    async function pollTranscriptJob({ jobId, token, signal, onProgress }) {
      for (let attempt = 0; attempt < pollMaxAttempts; attempt += 1) {
        if (signal?.aborted) {
          throw new Error('CANCELED');
        }

        const job = await fetchJobStatus({ jobId, token, signal });
        const state = resolveJobState(job);

        if (state.status === 'done') {
          return state.transcript;
        }
        if (state.status === 'error') {
          throw new Error(state.error || 'AI transcription failed');
        }
        if (state.status === 'canceled') {
          throw new Error('CANCELED');
        }

        if (onProgress) {
          onProgress({ message: 'Transcribing...' });
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error('AI transcription timed out');
    }

    return { pollTranscriptJob };
  }

  transcripts.aiTranscriptionPolling = {
    createAiTranscriptionPollingService,
  };
})();
