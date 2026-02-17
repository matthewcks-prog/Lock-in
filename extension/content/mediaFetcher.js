/**
 * Media Fetcher for Content Script
 *
 * Handles fetching authenticated media that may be blocked by CORS
 * when fetched from the background script.
 *
 * Industry Best Practice: Use content script for same-origin media access
 * since content scripts run in the page's security context.
 */

/* eslint-disable max-lines -- Refactored IIFE structure with extracted helpers still exceeds limit by a few lines */

// eslint-disable-next-line max-statements -- IIFE wrapper required for Chrome extension scope isolation
(function () {
  // Constants
  const BYTES_PER_KB = 1024;
  const MB_PER_CHUNK = 4;
  const CHUNK_SIZE = MB_PER_CHUNK * BYTES_PER_KB * BYTES_PER_KB;
  const HTTP_STATUS_REDIRECT_MIN = 300;
  const HTTP_STATUS_REDIRECT_MAX = 400;
  const HTTP_STATUS_UNAUTHORIZED = 401;
  const HTTP_STATUS_FORBIDDEN = 403;

  const NetworkRetry = typeof window !== 'undefined' ? window.LockInNetworkRetry : null;
  const MEDIA_FETCH_RETRY_CONFIG = {
    maxRetries: 2,
    timeoutMs: 20000,
  };

  function fetchWithRetry(url, options, overrides = {}) {
    if (!NetworkRetry?.fetchWithRetry) {
      throw new Error('Network retry utilities unavailable');
    }
    return NetworkRetry.fetchWithRetry(url, options, {
      ...MEDIA_FETCH_RETRY_CONFIG,
      ...overrides,
      context: overrides.context || 'media fetch',
    });
  }

  // Known SSO/auth domains that indicate session expiration
  const SSO_DOMAINS = ['okta.com', 'auth0.com', 'login.microsoftonline.com', 'accounts.google.com'];

  function isSsoRedirect(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return SSO_DOMAINS.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  function isCdnUrl(url) {
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
  }

  function isRedirectResponse(response) {
    return (
      response.type === 'opaqueredirect' ||
      response.status === 0 ||
      (response.status >= HTTP_STATUS_REDIRECT_MIN && response.status < HTTP_STATUS_REDIRECT_MAX)
    );
  }

  async function handleInitialFetch(mediaUrl, signal) {
    console.log('[Lock-in MediaFetcher] Fetching with credentials + manual redirect');
    const response = await fetchWithRetry(mediaUrl, {
      method: 'GET',
      credentials: 'include',
      redirect: 'manual',
      signal,
    });

    console.log('[Lock-in MediaFetcher] Initial response:', response.status, response.type);
    return response;
  }

  async function followLocationRedirect(location, signal) {
    if (isSsoRedirect(location)) {
      console.log('[Lock-in MediaFetcher] SSO redirect detected - session expired');
      return {
        error: 'Your session has expired. Please refresh the page and log in again.',
        errorCode: 'SESSION_EXPIRED',
      };
    }

    const useCredentials = !isCdnUrl(location);
    console.log(
      `[Lock-in MediaFetcher] Following redirect to: ${location} with credentials: ${useCredentials}`,
    );

    const response = await fetchWithRetry(location, {
      method: 'GET',
      credentials: useCredentials ? 'include' : 'omit',
      signal,
    });
    console.log('[Lock-in MediaFetcher] Redirect response:', response.status, response.statusText);
    return { response };
  }

  async function handleCrossOriginRedirect(mediaUrl, signal) {
    console.log(
      '[Lock-in MediaFetcher] No location header (cross-origin redirect), trying with same-origin credentials',
    );
    try {
      const response = await fetchWithRetry(mediaUrl, {
        method: 'GET',
        credentials: 'same-origin',
        signal,
      });
      console.log(
        '[Lock-in MediaFetcher] Same-origin credentials fetch succeeded:',
        response.status,
      );
      return { response };
    } catch (sameOriginError) {
      console.log('[Lock-in MediaFetcher] Same-origin fetch failed:', sameOriginError.message);
      console.log('[Lock-in MediaFetcher] Retrying without credentials (CDN may have cached auth)');
      const response = await fetchWithRetry(mediaUrl, {
        method: 'GET',
        credentials: 'omit',
        signal,
      });
      return { response };
    }
  }

  async function fetchWithRedirectHandling(mediaUrl, signal) {
    const response = await handleInitialFetch(mediaUrl, signal);

    if (!isRedirectResponse(response)) {
      return { response };
    }

    const location = response.headers.get('location');
    console.log('[Lock-in MediaFetcher] Redirect detected, location:', location);

    if (location) {
      return followLocationRedirect(location, signal);
    }

    return handleCrossOriginRedirect(mediaUrl, signal);
  }

  async function sendFinalChunk(buffer, chunkIndex, onChunk) {
    const hasBuffer = buffer.length > 0;
    console.log(
      `[Lock-in MediaFetcher] ${hasBuffer ? `Sending final chunk: ${chunkIndex} size: ${buffer.length}` : 'Buffer empty at end (exact chunk boundary), sending completion signal'}`,
    );
    await onChunk(hasBuffer ? buffer : null, chunkIndex, true);
  }

  async function processBufferedChunks(buffer, chunkIndex, onChunk) {
    let index = chunkIndex;
    let remainingBuffer = buffer;

    while (remainingBuffer.length >= CHUNK_SIZE) {
      const chunk = remainingBuffer.slice(0, CHUNK_SIZE);
      remainingBuffer = remainingBuffer.slice(CHUNK_SIZE);

      console.log('[Lock-in MediaFetcher] Sending chunk:', index, 'size:', chunk.length);
      await onChunk(chunk, index, false);
      index++;
    }

    return { newBuffer: remainingBuffer, newIndex: index };
  }

  async function streamResponseAsChunks(response, onChunk) {
    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);
    let chunkIndex = 0;
    let totalBytesRead = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        await sendFinalChunk(buffer, chunkIndex, onChunk);
        break;
      }

      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
      totalBytesRead += value.length;

      const result = await processBufferedChunks(buffer, chunkIndex, onChunk);
      buffer = result.newBuffer;
      chunkIndex = result.newIndex;
    }

    return {
      totalBytesRead,
      chunksCount: buffer.length > 0 ? chunkIndex + 1 : chunkIndex,
    };
  }

  function createAuthError(status) {
    const isUnauthorized = status === HTTP_STATUS_UNAUTHORIZED;
    const isForbidden = status === HTTP_STATUS_FORBIDDEN;

    if (isUnauthorized || isForbidden) {
      return {
        success: false,
        error: 'Authentication required. Please refresh the page and ensure you are logged in.',
        errorCode: 'AUTH_REQUIRED',
      };
    }
    return null;
  }

  function createHttpError(response) {
    return {
      success: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      errorCode: 'FETCH_ERROR',
    };
  }

  function parseContentLength(response) {
    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
    console.log('[Lock-in MediaFetcher] Content-Length:', totalBytes);
    return totalBytes;
  }

  async function processSuccessfulResponse(response, onChunk) {
    if (!response.body) {
      return {
        success: false,
        error: 'No response body available',
        errorCode: 'NO_BODY',
      };
    }

    parseContentLength(response);
    const { totalBytesRead, chunksCount } = await streamResponseAsChunks(response, onChunk);

    console.log('[Lock-in MediaFetcher] Fetch complete. Total bytes:', totalBytesRead);
    return {
      success: true,
      totalBytes: totalBytesRead,
      chunksCount,
    };
  }

  function createErrorResult(error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Fetch aborted', errorCode: 'ABORTED' };
    }

    const message = error instanceof Error ? error.message : String(error);
    const isNetworkError =
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('CORS');

    if (isNetworkError) {
      return {
        success: false,
        error:
          'Could not fetch media. Your session may have expired - please refresh the page and ensure you are logged in.',
        errorCode: 'CORS_ERROR',
      };
    }

    return { success: false, error: message, errorCode: 'UNKNOWN_ERROR' };
  }

  async function fetchMediaAsChunks(mediaUrl, onChunk, signal) {
    console.log('[Lock-in MediaFetcher] Starting media fetch:', mediaUrl);

    try {
      const resolved = await fetchWithRedirectHandling(mediaUrl, signal);
      if (resolved.errorCode) {
        return {
          success: false,
          error: resolved.error,
          errorCode: resolved.errorCode,
        };
      }

      const response = resolved.response;
      if (!response.ok) {
        const authError = createAuthError(response.status);
        if (authError) return authError;
        return createHttpError(response);
      }

      return processSuccessfulResponse(response, onChunk);
    } catch (error) {
      console.error('[Lock-in MediaFetcher] Fetch error:', error);
      return createErrorResult(error);
    }
  }

  async function handleMediaFetchRequest(payload, sendChunk) {
    const { mediaUrl, jobId, requestId } = payload;

    console.log('[Lock-in MediaFetcher] Handling fetch request:', {
      mediaUrl,
      jobId,
      requestId,
    });

    return fetchMediaAsChunks(mediaUrl, async (chunk, index, isLast) => {
      const chunkBuffer =
        chunk && chunk.byteLength
          ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
          : null;
      await sendChunk({
        type: 'MEDIA_CHUNK',
        payload: {
          requestId,
          jobId,
          chunkIndex: index,
          chunkData: chunkBuffer,
          chunkSize: chunk ? chunk.length : 0,
          isLast,
        },
      });
    });
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Export for use in content script
  if (typeof window !== 'undefined') {
    window.LockInMediaFetcher = {
      fetchMediaAsChunks,
      handleMediaFetchRequest,
      arrayBufferToBase64,
      base64ToArrayBuffer,
    };
  }
})();
