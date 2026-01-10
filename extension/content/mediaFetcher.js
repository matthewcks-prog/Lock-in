/**
 * Media Fetcher for Content Script
 *
 * Handles fetching authenticated media that may be blocked by CORS
 * when fetched from the background script.
 *
 * Industry Best Practice: Use content script for same-origin media access
 * since content scripts run in the page's security context.
 */

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks to match backend

/**
 * Fetch media from a URL and return it as chunks
 * This runs in the content script context which has access to same-origin resources
 *
 * @param {string} mediaUrl - The URL of the media to fetch
 * @param {function} onChunk - Callback for each chunk: (chunk: Uint8Array, index: number, isLast: boolean) => Promise<void>
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<{success: boolean, error?: string, totalBytes?: number}>}
 */
/**
 * Known SSO/auth domains that indicate session expiration
 */
const SSO_DOMAINS = ['okta.com', 'auth0.com', 'login.microsoftonline.com', 'accounts.google.com'];

/**
 * Check if a URL is an SSO/authentication redirect
 */
function isSsoRedirect(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SSO_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a CDN that doesn't need credentials
 */
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

async function fetchMediaAsChunks(mediaUrl, onChunk, signal) {
  console.log('[Lock-in MediaFetcher] Starting media fetch:', mediaUrl);

  try {
    // Use manual redirect handling to properly handle auth + CDN scenarios
    // 1. Moodle requires cookies for auth
    // 2. If authenticated, Moodle redirects to CDN with signed URL
    // 3. CDN doesn't need cookies (signed URL) and returns Access-Control-Allow-Origin: *
    // 4. credentials: 'include' + ACAO: * = CORS error
    // Solution: Handle redirects manually, use credentials for origin, omit for CDN

    console.log('[Lock-in MediaFetcher] Fetching with credentials + manual redirect');
    let response = await fetch(mediaUrl, {
      method: 'GET',
      credentials: 'include',
      redirect: 'manual', // Don't auto-follow redirects
      signal,
    });

    console.log('[Lock-in MediaFetcher] Initial response:', response.status, response.type);

    // Handle redirects manually
    if (
      response.type === 'opaqueredirect' ||
      response.status === 0 ||
      (response.status >= 300 && response.status < 400)
    ) {
      // Try to get the redirect URL from headers (may not be available due to CORS)
      const location = response.headers.get('location');
      console.log('[Lock-in MediaFetcher] Redirect detected, location:', location);

      if (location) {
        // Check if redirecting to SSO (session expired)
        if (isSsoRedirect(location)) {
          console.log('[Lock-in MediaFetcher] SSO redirect detected - session expired');
          return {
            success: false,
            error: 'Your session has expired. Please refresh the page and log in again.',
            errorCode: 'SESSION_EXPIRED',
          };
        }

        // Follow the redirect - use appropriate credentials mode
        const useCredentials = !isCdnUrl(location);
        console.log(
          '[Lock-in MediaFetcher] Following redirect to:',
          location,
          'with credentials:',
          useCredentials,
        );

        response = await fetch(location, {
          method: 'GET',
          credentials: useCredentials ? 'include' : 'omit',
          signal,
        });
        console.log(
          '[Lock-in MediaFetcher] Redirect response:',
          response.status,
          response.statusText,
        );
      } else {
        // Can't get location header due to CORS - the redirect destination is cross-origin
        // This typically means: Moodle (same-origin) redirects to CDN (cross-origin)
        //
        // Strategy: Use 'same-origin' credentials mode
        // - This sends cookies to Moodle (same-origin) for auth
        // - But omits cookies for the CDN (cross-origin), avoiding the CORS conflict
        //   where CDN returns Access-Control-Allow-Origin: * which is incompatible with credentials
        console.log(
          '[Lock-in MediaFetcher] No location header (cross-origin redirect), trying with same-origin credentials',
        );
        try {
          response = await fetch(mediaUrl, {
            method: 'GET',
            credentials: 'same-origin', // Credentials for origin only, not for CDN
            signal,
          });
          console.log(
            '[Lock-in MediaFetcher] Same-origin credentials fetch succeeded:',
            response.status,
          );
        } catch (sameOriginError) {
          // If same-origin also fails, the server might require 'include' for the initial request
          // Try a two-step approach: HEAD to warm up auth, then GET without credentials
          console.log('[Lock-in MediaFetcher] Same-origin fetch failed:', sameOriginError.message);
          console.log(
            '[Lock-in MediaFetcher] Retrying without credentials (CDN may have cached auth)',
          );
          response = await fetch(mediaUrl, {
            method: 'GET',
            credentials: 'omit',
            signal,
          });
        }
      }
    }

    // Check final response
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Authentication required. Please refresh the page and ensure you are logged in.',
          errorCode: 'AUTH_REQUIRED',
        };
      }
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        errorCode: 'FETCH_ERROR',
      };
    }

    if (!response.body) {
      return {
        success: false,
        error: 'No response body available',
        errorCode: 'NO_BODY',
      };
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
    console.log('[Lock-in MediaFetcher] Content-Length:', totalBytes);

    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);
    let chunkIndex = 0;
    let totalBytesRead = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Send any remaining buffer as the last chunk
        if (buffer.length > 0) {
          console.log(
            '[Lock-in MediaFetcher] Sending final chunk:',
            chunkIndex,
            'size:',
            buffer.length,
          );
          await onChunk(buffer, chunkIndex, true);
        } else {
          // Edge case: media size was exactly a multiple of CHUNK_SIZE
          // Buffer is empty but we still need to emit completion signal
          // Send an empty final chunk to signal completion
          console.log(
            '[Lock-in MediaFetcher] Buffer empty at end (exact chunk boundary), sending completion signal',
          );
          await onChunk(new Uint8Array(0), chunkIndex, true);
        }
        break;
      }

      // Append new data to buffer
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
      totalBytesRead += value.length;

      // Send full chunks
      while (buffer.length >= CHUNK_SIZE) {
        const chunk = buffer.slice(0, CHUNK_SIZE);
        buffer = buffer.slice(CHUNK_SIZE);

        console.log('[Lock-in MediaFetcher] Sending chunk:', chunkIndex, 'size:', chunk.length);
        await onChunk(chunk, chunkIndex, false);
        chunkIndex++;
      }
    }

    console.log('[Lock-in MediaFetcher] Fetch complete. Total bytes:', totalBytesRead);
    return {
      success: true,
      totalBytes: totalBytesRead,
      chunksCount: chunkIndex + 1,
    };
  } catch (error) {
    console.error('[Lock-in MediaFetcher] Fetch error:', error);

    if (error.name === 'AbortError') {
      return { success: false, error: 'Fetch aborted', errorCode: 'ABORTED' };
    }

    const message = error instanceof Error ? error.message : String(error);

    // Check for CORS/network errors - likely session expiration causing SSO redirect
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('CORS')
    ) {
      return {
        success: false,
        error:
          'Could not fetch media. Your session may have expired - please refresh the page and ensure you are logged in.',
        errorCode: 'CORS_ERROR',
      };
    }

    return { success: false, error: message, errorCode: 'UNKNOWN_ERROR' };
  }
}

/**
 * Handle media fetch request from background script
 *
 * @param {object} payload - { mediaUrl, jobId, requestId }
 * @param {function} sendChunk - Function to send chunk to background
 * @returns {Promise<object>}
 */
async function handleMediaFetchRequest(payload, sendChunk) {
  const { mediaUrl, jobId, requestId } = payload;

  console.log('[Lock-in MediaFetcher] Handling fetch request:', {
    mediaUrl,
    jobId,
    requestId,
  });

  return fetchMediaAsChunks(mediaUrl, async (chunk, index, isLast) => {
    // Convert Uint8Array to base64 for messaging
    const base64 = arrayBufferToBase64(chunk);
    await sendChunk({
      type: 'MEDIA_CHUNK',
      payload: {
        requestId,
        jobId,
        chunkIndex: index,
        chunkData: base64,
        chunkSize: chunk.length,
        isLast,
      },
    });
  });
}

/**
 * Convert ArrayBuffer/Uint8Array to base64 string
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
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
