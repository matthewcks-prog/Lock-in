(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createAiTranscriptionRequests({ config, networkUtils, aiUtils, validators }) {
    const fetchWithRetry = networkUtils?.fetchWithRetry;
    const AUTH_REQUEST_MAX_RETRIES = 2;
    const AUTH_REQUEST_TIMEOUT_MS = 15000;
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    const validateJobResponse =
      runtimeValidators?.validateTranscriptJobResponse ||
      ((value) => ({ ok: true, value: value || { success: false } }));
    const validateJobListResponse =
      runtimeValidators?.validateTranscriptJobListResponse ||
      ((value) => ({ ok: true, value: value || { success: false, jobs: [] } }));
    const validateCancelAllResponse =
      runtimeValidators?.validateTranscriptCancelAllResponse ||
      ((value) => ({ ok: true, value: value || { success: false, canceledIds: [] } }));

    function buildAuthHeaders(token, extraHeaders) {
      return Object.assign({}, extraHeaders || {}, {
        Authorization: `Bearer ${token}`,
      });
    }

    async function parseJsonResponse(response) {
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    async function fetchJsonWithAuth(url, token, options = {}) {
      if (typeof fetchWithRetry !== 'function') {
        throw new Error('Network utilities unavailable');
      }

      const headers = buildAuthHeaders(token, options.headers);
      const response = await fetchWithRetry(
        url,
        { ...options, headers },
        AUTH_REQUEST_MAX_RETRIES,
        AUTH_REQUEST_TIMEOUT_MS,
      );
      const data = await parseJsonResponse(response);

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

    async function createTranscriptionJob({ token, payload, signal }) {
      const backendUrl = config.getBackendUrl();
      const data = await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      const parsed = validateJobResponse(data);
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Invalid transcript job response');
      }
      return parsed.value;
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
      const data = await fetchJsonWithAuth(
        `${backendUrl}/api/transcripts/jobs/${jobId}/finalize`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        },
      );
      const parsed = validateJobResponse(data);
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Invalid transcript finalize response');
      }
      return parsed.value;
    }

    async function cancelTranscriptJob({ jobId, token }) {
      if (!jobId || !token) return;
      const backendUrl = config.getBackendUrl();
      const data = await fetchJsonWithAuth(
        `${backendUrl}/api/transcripts/jobs/${jobId}/cancel`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      const parsed = validateJobResponse(data);
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Invalid transcript cancel response');
      }
      return parsed.value;
    }

    async function listActiveTranscriptJobs({ token }) {
      if (!token) throw new Error('No auth token provided');
      const backendUrl = config.getBackendUrl();
      const data = await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/active`, token, {
        method: 'GET',
      });
      const parsed = validateJobListResponse(data);
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Invalid transcript list response');
      }
      return parsed.value;
    }

    async function cancelAllActiveTranscriptJobs({ token }) {
      if (!token) throw new Error('No auth token provided');
      const backendUrl = config.getBackendUrl();
      const data = await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/cancel-all`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const parsed = validateCancelAllResponse(data);
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Invalid transcript cancel-all response');
      }
      return parsed.value;
    }

    return {
      fetchJsonWithAuth,
      fetchMediaHeadMetadata,
      createTranscriptionJob,
      finalizeTranscriptionJob,
      cancelTranscriptJob,
      listActiveTranscriptJobs,
      cancelAllActiveTranscriptJobs,
    };
  }

  transcripts.aiTranscriptionRequests = {
    createAiTranscriptionRequests,
  };
})();
