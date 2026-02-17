(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});
  const AUTH_REQUEST_MAX_RETRIES = 2;
  const AUTH_REQUEST_TIMEOUT_MS = 15000;

  function createRuntimeValidators(validators) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    const createPassThroughValidator = (fallbackValue) => (value) => ({
      ok: true,
      value: value || fallbackValue,
    });
    return {
      validateJobResponse:
        runtimeValidators?.validateTranscriptJobResponse ||
        createPassThroughValidator({ success: false }),
      validateJobListResponse:
        runtimeValidators?.validateTranscriptJobListResponse ||
        createPassThroughValidator({ success: false, jobs: [] }),
      validateCancelAllResponse:
        runtimeValidators?.validateTranscriptCancelAllResponse ||
        createPassThroughValidator({ success: false, canceledIds: [] }),
    };
  }

  function buildAuthHeaders(token, extraHeaders) {
    return Object.assign({}, extraHeaders || {}, { Authorization: `Bearer ${token}` });
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

  function ensureFetchWithRetry(fetchWithRetry) {
    if (typeof fetchWithRetry === 'function') return fetchWithRetry;
    throw new Error('Network utilities unavailable');
  }

  function createRequestError(data, response) {
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
    return error;
  }

  async function fetchJsonWithAuth({ fetchWithRetry, url, token, options = {} }) {
    const safeFetchWithRetry = ensureFetchWithRetry(fetchWithRetry);
    const headers = buildAuthHeaders(token, options.headers);
    const response = await safeFetchWithRetry(
      url,
      { ...options, headers },
      AUTH_REQUEST_MAX_RETRIES,
      AUTH_REQUEST_TIMEOUT_MS,
    );
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw createRequestError(data, response);
    }
    return data;
  }

  async function fetchMediaHeadMetadata({ fetchWithRetry, aiUtils, mediaUrl, signal }) {
    try {
      const safeFetchWithRetry = ensureFetchWithRetry(fetchWithRetry);
      const response = await safeFetchWithRetry(mediaUrl, {
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

  function parseValidatedResponse({ data, validator, errorMessage }) {
    const parsed = validator(data);
    if (!parsed.ok) {
      throw new Error(parsed.error || errorMessage);
    }
    return parsed.value;
  }

  async function createTranscriptionJob({
    backendUrl,
    fetchJsonWithAuthFn,
    validateJobResponse,
    token,
    payload,
    signal,
  }) {
    const data = await fetchJsonWithAuthFn(`${backendUrl}/api/transcripts/jobs`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    return parseValidatedResponse({
      data,
      validator: validateJobResponse,
      errorMessage: 'Invalid transcript job response',
    });
  }

  async function finalizeTranscriptionJob({
    backendUrl,
    fetchJsonWithAuthFn,
    validateJobResponse,
    jobId,
    token,
    options,
    expectedTotalChunks,
    signal,
  }) {
    const payload = Object.assign({}, options || {});
    if (expectedTotalChunks) {
      payload.expectedTotalChunks = expectedTotalChunks;
    }
    const data = await fetchJsonWithAuthFn(
      `${backendUrl}/api/transcripts/jobs/${jobId}/finalize`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      },
    );
    return parseValidatedResponse({
      data,
      validator: validateJobResponse,
      errorMessage: 'Invalid transcript finalize response',
    });
  }

  async function cancelTranscriptJob({
    backendUrl,
    fetchJsonWithAuthFn,
    validateJobResponse,
    jobId,
    token,
  }) {
    if (!jobId || !token) return;
    const data = await fetchJsonWithAuthFn(
      `${backendUrl}/api/transcripts/jobs/${jobId}/cancel`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    return parseValidatedResponse({
      data,
      validator: validateJobResponse,
      errorMessage: 'Invalid transcript cancel response',
    });
  }

  async function listActiveTranscriptJobs({
    backendUrl,
    fetchJsonWithAuthFn,
    validateJobListResponse,
    token,
  }) {
    if (!token) throw new Error('No auth token provided');
    const data = await fetchJsonWithAuthFn(`${backendUrl}/api/transcripts/jobs/active`, token, {
      method: 'GET',
    });
    return parseValidatedResponse({
      data,
      validator: validateJobListResponse,
      errorMessage: 'Invalid transcript list response',
    });
  }

  async function cancelAllActiveTranscriptJobs({
    backendUrl,
    fetchJsonWithAuthFn,
    validateCancelAllResponse,
    token,
  }) {
    if (!token) throw new Error('No auth token provided');
    const data = await fetchJsonWithAuthFn(`${backendUrl}/api/transcripts/jobs/cancel-all`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return parseValidatedResponse({
      data,
      validator: validateCancelAllResponse,
      errorMessage: 'Invalid transcript cancel-all response',
    });
  }

  function createAiTranscriptionRequests({ config, networkUtils, aiUtils, validators }) {
    const backendUrl = config.getBackendUrl();
    const fetchWithRetry = networkUtils?.fetchWithRetry;
    const runtimeValidators = createRuntimeValidators(validators);
    const fetchJsonWithAuthFn = (url, token, options) =>
      fetchJsonWithAuth({ fetchWithRetry, url, token, options });
    const baseArgs = { backendUrl, fetchJsonWithAuthFn };
    const validateJobResponse = runtimeValidators.validateJobResponse;

    return {
      fetchJsonWithAuth: fetchJsonWithAuthFn,
      fetchMediaHeadMetadata: (mediaUrl, signal) =>
        fetchMediaHeadMetadata({ fetchWithRetry, aiUtils, mediaUrl, signal }),
      createTranscriptionJob: ({ token, payload, signal }) =>
        createTranscriptionJob({ ...baseArgs, validateJobResponse, token, payload, signal }),
      finalizeTranscriptionJob: ({ jobId, token, options, expectedTotalChunks, signal }) =>
        finalizeTranscriptionJob({
          ...baseArgs,
          validateJobResponse,
          jobId,
          token,
          options,
          expectedTotalChunks,
          signal,
        }),
      cancelTranscriptJob: ({ jobId, token }) =>
        cancelTranscriptJob({ ...baseArgs, validateJobResponse, jobId, token }),
      listActiveTranscriptJobs: ({ token }) =>
        listActiveTranscriptJobs({
          ...baseArgs,
          validateJobListResponse: runtimeValidators.validateJobListResponse,
          token,
        }),
      cancelAllActiveTranscriptJobs: ({ token }) =>
        cancelAllActiveTranscriptJobs({
          ...baseArgs,
          validateCancelAllResponse: runtimeValidators.validateCancelAllResponse,
          token,
        }),
    };
  }

  transcripts.aiTranscriptionRequests = {
    createAiTranscriptionRequests,
  };
})();
