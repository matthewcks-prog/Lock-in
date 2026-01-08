(() => {
  // Network utilities shared by background helpers.

  /** Default retry configuration */
  const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    timeoutMs: 30000, // 30 second timeout
  };

  /**
   * Delay for exponential backoff
   * @param {number} attempt - Current attempt (0-based)
   * @returns {Promise<void>}
   */
  function backoffDelay(attempt) {
    const delay = Math.min(
      RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
      RETRY_CONFIG.maxDelayMs,
    );
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @param {Response} response - The response object if available
   * @returns {boolean}
   */
  function isRetryableError(error, response) {
    // Don't retry auth errors - user needs to sign in
    if (response && (response.status === 401 || response.status === 403)) {
      return false;
    }
    // Don't retry 404 - resource doesn't exist
    if (response && response.status === 404) {
      return false;
    }
    // Retry network errors and 5xx server errors
    if (!response || response.status >= 500) {
      return true;
    }
    // Retry rate limiting (429)
    if (response.status === 429) {
      return true;
    }
    return false;
  }

  /**
   * Fetch with retry and exponential backoff
   * @param {string} url - URL to fetch
   * @param {RequestInit} options - Fetch options
   * @param {number} maxRetries - Maximum retry attempts (default from config)
   * @param {number} timeoutMs - Request timeout in milliseconds (default from config)
   * @returns {Promise<Response>}
   */
  async function fetchWithRetry(
    url,
    options = {},
    maxRetries = RETRY_CONFIG.maxRetries,
    timeoutMs = RETRY_CONFIG.timeoutMs,
  ) {
    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Merge abort signal with existing options
        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };

        console.log(
          `[Lock-in] Fetching (attempt ${attempt + 1}/${
            maxRetries + 1
          }): ${url.substring(0, 100)}...`,
        );
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        lastResponse = response;

        console.log(`[Lock-in] Response status: ${response.status} ${response.statusText}`);

        // If successful or non-retryable error, return
        if (response.ok || !isRetryableError(null, response)) {
          return response;
        }

        // Retryable error
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error;
        console.error(`[Lock-in] Fetch error (attempt ${attempt + 1}):`, error.message || error);

        // Specific error handling for better debugging
        if (error.name === 'AbortError') {
          console.warn(`[Lock-in] Request timeout after ${timeoutMs}ms`);
          lastError = new Error(`Request timeout after ${timeoutMs}ms`);
        } else if (error.message === 'Failed to fetch') {
          console.warn(
            '[Lock-in] Network error: Failed to fetch. Possible causes: CORS, DNS, or network connectivity',
          );
        }

        // Network errors are retryable
        if (attempt < maxRetries) {
          console.log(
            `[Lock-in] Retrying in ${RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)}ms...`,
          );
          await backoffDelay(attempt);
          continue;
        }
      }

      // If this wasn't the last attempt, wait and retry
      if (attempt < maxRetries && isRetryableError(lastError, lastResponse)) {
        console.log(
          `[Lock-in] Retrying in ${RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)}ms...`,
        );
        await backoffDelay(attempt);
      }
    }

    // Return last response if we have one, otherwise throw
    if (lastResponse) {
      return lastResponse;
    }
    throw lastError;
  }

  /**
   * Fetch HTML with credentials (with retry)
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  async function fetchWithCredentials(url) {
    console.log('[Lock-in] fetchWithCredentials:', url.substring(0, 100));

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      console.error('[Lock-in] Invalid URL:', url, e);
      throw new Error('Invalid URL provided');
    }

    const response = await fetchWithRetry(url, {
      method: 'GET',
      credentials: 'include',
      mode: 'cors', // Explicitly set CORS mode
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Chrome Extension)',
      },
    });

    if (!response.ok) {
      console.error(`[Lock-in] Response not OK: ${response.status} ${response.statusText}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    console.log(`[Lock-in] Fetched ${text.length} bytes successfully`);
    return text;
  }

  /**
   * Fetch VTT content (with retry)
   * @param {string} url - Caption VTT URL
   * @returns {Promise<string>} VTT content
   */
  async function fetchVttContent(url) {
    console.log('[Lock-in] fetchVttContent:', url.substring(0, 100));

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      console.error('[Lock-in] Invalid caption URL:', url, e);
      throw new Error('Invalid caption URL');
    }

    const response = await fetchWithRetry(url, {
      method: 'GET',
      credentials: 'include',
      mode: 'cors', // Explicitly set CORS mode
      headers: {
        Accept: 'text/vtt,text/plain,*/*',
        'User-Agent': 'Mozilla/5.0 (Chrome Extension)',
      },
    });

    if (!response.ok) {
      console.error(`[Lock-in] VTT fetch failed: ${response.status} ${response.statusText}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    console.log(`[Lock-in] Fetched VTT: ${text.length} bytes`);
    return text;
  }

  async function fetchHtmlWithRedirectInfo(url) {
    console.log('[Lock-in] fetchHtmlWithRedirectInfo:', url.substring(0, 100));

    try {
      new URL(url);
    } catch (e) {
      console.error('[Lock-in] Invalid URL:', url, e);
      throw new Error('Invalid URL provided');
    }

    const response = await fetchWithRetry(url, {
      method: 'GET',
      credentials: 'include',
      mode: 'cors',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Chrome Extension)',
      },
    });

    if (!response.ok) {
      console.error(`[Lock-in] Response not OK: ${response.status} ${response.statusText}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return {
      html,
      finalUrl: response.url || url,
      redirected: response.redirected,
      status: response.status,
    };
  }

  if (typeof self !== 'undefined') {
    self.LockInNetworkUtils = {
      RETRY_CONFIG,
      backoffDelay,
      isRetryableError,
      fetchWithRetry,
      fetchWithCredentials,
      fetchVttContent,
      fetchHtmlWithRedirectInfo,
    };
  }
})();
