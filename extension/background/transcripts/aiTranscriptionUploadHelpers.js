const aiUploadHelpersRoot = typeof globalThis !== 'undefined' ? globalThis : self;
const aiUploadHelpersRegistry =
  aiUploadHelpersRoot.LockInBackground || (aiUploadHelpersRoot.LockInBackground = {});
const aiUploadHelpersTranscripts =
  aiUploadHelpersRegistry.transcripts || (aiUploadHelpersRegistry.transcripts = {});

const CHUNK_UPLOAD_TIMEOUT_MS = 30000;
const MEDIA_FETCH_MAX_RETRIES = 2;
const MEDIA_FETCH_TIMEOUT_MS = 20000;
const DEFAULT_CHUNK_UPLOAD_MAX_RETRIES = 5;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_GATEWAY_TIMEOUT = 504;
const HTTP_REDIRECT_STATUS_MIN = 300;
const HTTP_REDIRECT_STATUS_MAX_EXCLUSIVE = 400;
const SSO_DOMAINS = ['okta.com', 'auth0.com', 'login.microsoftonline.com', 'accounts.google.com'];

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isSsoRedirect(url) {
  const hostname = getHostname(url);
  if (hostname === null) return false;
  return SSO_DOMAINS.some((domain) => hostname.includes(domain));
}

function isCdnUrl(url) {
  const hostname = getHostname(url);
  if (hostname === null) return false;
  return (
    hostname.includes('cloudfront.net') ||
    hostname.includes('cdn.') ||
    hostname.includes('akamai') ||
    hostname.includes('fastly') ||
    hostname.includes('cloudflare')
  );
}

function buildChunkHeaders({ token, index, totalChunks }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/octet-stream',
    'x-chunk-index': String(index),
  };
  if (totalChunks) headers['x-total-chunks'] = String(totalChunks);
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

function createSendChunkWithRetry({ fetchWithRetry, log }) {
  return async function sendChunkWithRetry({
    backendUrl,
    jobId,
    token,
    signal,
    chunk,
    index,
    totalChunks,
    maxRetries = DEFAULT_CHUNK_UPLOAD_MAX_RETRIES,
  }) {
    if (signal?.aborted) throw new Error('CANCELED');
    if (typeof fetchWithRetry !== 'function') throw new Error('Network utilities unavailable');

    const response = await fetchWithRetry(
      `${backendUrl}/api/transcripts/jobs/${jobId}/chunks`,
      {
        method: 'PUT',
        headers: buildChunkHeaders({ token, index, totalChunks }),
        body: chunk,
        signal,
      },
      {
        maxRetries,
        timeoutMs: CHUNK_UPLOAD_TIMEOUT_MS,
        retryableStatuses: [
          HTTP_STATUS_TOO_MANY_REQUESTS,
          HTTP_STATUS_BAD_GATEWAY,
          HTTP_STATUS_SERVICE_UNAVAILABLE,
          HTTP_STATUS_GATEWAY_TIMEOUT,
        ],
        retryOnServerError: true,
        onRetry: (info) => {
          log.info(
            `Retrying chunk ${index} in ${info.delayMs}ms (attempt ${info.attempt}/${maxRetries})`,
          );
        },
      },
    );

    if (response.ok) return;
    const data = await parseErrorPayload(response);
    throw new Error(
      data?.error?.message || data?.error || `Chunk upload failed: ${response.status}`,
    );
  };
}

function isRedirectResponse(response) {
  return (
    response.type === 'opaqueredirect' ||
    response.status === 0 ||
    (response.status >= HTTP_REDIRECT_STATUS_MIN &&
      response.status < HTTP_REDIRECT_STATUS_MAX_EXCLUSIVE)
  );
}

async function followRedirect({ response, signal, fetchWithRetry, log, errors }) {
  const location = response.headers.get('location');
  log.info('Redirect detected, location:', location);
  if (!location) {
    log.info('No location header, falling back to content script');
    throw errors.createErrorWithCode('CORS_BLOCKED', 'CORS_BLOCKED');
  }
  if (isSsoRedirect(location)) {
    throw errors.createErrorWithCode(
      'Your session has expired. Please refresh the page and log in again.',
      'SESSION_EXPIRED',
    );
  }
  const useCredentials = !isCdnUrl(location);
  log.info('Following redirect, credentials:', useCredentials);
  return fetchWithRetry(
    location,
    { method: 'GET', credentials: useCredentials ? 'include' : 'omit', signal },
    MEDIA_FETCH_MAX_RETRIES,
    MEDIA_FETCH_TIMEOUT_MS,
  );
}

async function fetchDirectMediaResponse({
  mediaUrl,
  signal,
  fetchWithRetry,
  log,
  errors,
  aiUtils,
}) {
  log.info('Attempting direct media fetch:', mediaUrl);
  if (typeof fetchWithRetry !== 'function') {
    throw errors.createErrorWithCode('Network utilities unavailable', 'NOT_AVAILABLE');
  }

  let response = await fetchWithRetry(
    mediaUrl,
    { method: 'GET', credentials: 'include', redirect: 'manual', signal },
    MEDIA_FETCH_MAX_RETRIES,
    MEDIA_FETCH_TIMEOUT_MS,
  );
  log.info('Initial response:', response.status, response.type);
  if (isRedirectResponse(response)) {
    response = await followRedirect({ response, signal, fetchWithRetry, log, errors });
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
  onProgress,
  contentScriptMedia,
  sendChunkWithRetry,
  backendUrl,
  token,
  signal,
}) {
  let uploadedBytes = 0;
  let chunkIndex = 0;
  await contentScriptMedia.fetchMediaViaContentScript({
    tabId,
    mediaUrl,
    jobId,
    requestId,
    onChunk: async (chunkBytes, index) => {
      await sendChunkWithRetry({ backendUrl, jobId, token, signal, chunk: chunkBytes, index });
      uploadedBytes += chunkBytes.length;
      if (onProgress) onProgress({ bytesUploaded: uploadedBytes, chunkIndex: index });
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
function createAiTranscriptionUploadHelpers({
  config,
  aiUtils,
  errors,
  contentScriptMedia,
  log,
  chunkBytes,
  fetchWithRetry,
}) {
  const streamFactory =
    aiUploadHelpersTranscripts.aiTranscriptionUploadStream?.createStreamAndUploadResponse;
  const sendChunkWithRetry = createSendChunkWithRetry({ fetchWithRetry, log });
  const backendUrl = config.getBackendUrl();
  const streamAndUploadResponse =
    typeof streamFactory === 'function'
      ? streamFactory({ sendChunkWithRetry, chunkBytes, backendUrl })
      : async () => {
          throw new Error('Streaming upload helper unavailable');
        };
  return {
    fetchDirectMediaResponse: ({ mediaUrl, signal }) =>
      fetchDirectMediaResponse({ mediaUrl, signal, fetchWithRetry, log, errors, aiUtils }),
    shouldFallbackToContentScript,
    uploadViaContentScript: ({ tabId, mediaUrl, jobId, requestId, token, signal, onProgress }) =>
      uploadViaContentScript({
        tabId,
        mediaUrl,
        jobId,
        requestId,
        token,
        signal,
        onProgress,
        contentScriptMedia,
        sendChunkWithRetry,
        backendUrl,
      }),
    streamAndUploadResponse,
  };
}

aiUploadHelpersTranscripts.aiTranscriptionUploadHelpers = {
  createAiTranscriptionUploadHelpers,
};
