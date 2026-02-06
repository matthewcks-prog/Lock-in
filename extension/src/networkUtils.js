(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const NetworkRetry = root.LockInNetworkRetry || null;

  const fallbackDefaults = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    timeoutMs: 30000,
    retryableStatuses: [429],
    retryOnServerError: true,
    retryOnNetworkError: true,
    retryOnTimeout: true,
  };

  const defaultConfig = NetworkRetry?.DEFAULT_RETRY_CONFIG || fallbackDefaults;

  const RETRY_CONFIG = {
    maxRetries: defaultConfig.maxRetries,
    baseDelayMs: defaultConfig.baseDelayMs,
    maxDelayMs: defaultConfig.maxDelayMs,
    timeoutMs: defaultConfig.timeoutMs,
  };

  function backoffDelay(attempt) {
    const delay = Math.min(
      RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
      RETRY_CONFIG.maxDelayMs,
    );
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  function isRetryableError(error, response) {
    if (response && (response.status === 401 || response.status === 403)) {
      return false;
    }
    if (response && response.status === 404) {
      return false;
    }
    if (!response || response.status >= 500) {
      return true;
    }
    if (response.status === 429) {
      return true;
    }
    return false;
  }

  function normalizeRetryConfig(maxRetriesOrConfig, timeoutMs, overrides) {
    if (maxRetriesOrConfig && typeof maxRetriesOrConfig === 'object') {
      return { ...defaultConfig, ...maxRetriesOrConfig };
    }
    const merged = { ...defaultConfig, ...(overrides || {}) };
    if (typeof maxRetriesOrConfig === 'number') {
      merged.maxRetries = maxRetriesOrConfig;
    }
    if (typeof timeoutMs === 'number') {
      merged.timeoutMs = timeoutMs;
    }
    return merged;
  }

  async function fetchWithRetry(url, options = {}, maxRetriesOrConfig, timeoutMs, overrides) {
    const config = normalizeRetryConfig(maxRetriesOrConfig, timeoutMs, overrides);

    if (NetworkRetry?.fetchWithRetry) {
      const onRetry =
        config.onRetry ||
        ((info) => {
          console.log(
            `[Lock-in] Retry attempt ${info.attempt}/${config.maxRetries} after ${info.delayMs}ms`,
          );
        });

      return NetworkRetry.fetchWithRetry(url, options, {
        ...config,
        context: config.context || 'fetch',
        onRetry,
      });
    }

    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };

        console.log(
          `[Lock-in] Fetching (attempt ${attempt + 1}/${config.maxRetries + 1}): ${url.substring(0, 100)}...`,
        );
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        lastResponse = response;

        console.log(`[Lock-in] Response status: ${response.status} ${response.statusText}`);

        if (response.ok || !isRetryableError(null, response)) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error;
        console.error(`[Lock-in] Fetch error (attempt ${attempt + 1}):`, error.message || error);

        if (error.name === 'AbortError') {
          console.warn(`[Lock-in] Request timeout after ${config.timeoutMs}ms`);
          lastError = new Error(`Request timeout after ${config.timeoutMs}ms`);
        } else if (error.message === 'Failed to fetch') {
          console.warn(
            '[Lock-in] Network error: Failed to fetch. Possible causes: CORS, DNS, or network connectivity',
          );
        }

        if (attempt < config.maxRetries) {
          console.log(
            `[Lock-in] Retrying in ${RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)}ms...`,
          );
          await backoffDelay(attempt);
          continue;
        }
      }

      if (attempt < config.maxRetries && isRetryableError(lastError, lastResponse)) {
        console.log(
          `[Lock-in] Retrying in ${RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)}ms...`,
        );
        await backoffDelay(attempt);
      }
    }

    if (lastResponse) {
      return lastResponse;
    }
    throw lastError;
  }

  async function fetchWithCredentials(url) {
    console.log('[Lock-in] fetchWithCredentials:', url.substring(0, 100));

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

    const text = await response.text();
    console.log(`[Lock-in] Fetched ${text.length} bytes successfully`);
    return text;
  }

  async function fetchVttContent(url) {
    console.log('[Lock-in] fetchVttContent:', url.substring(0, 100));

    try {
      new URL(url);
    } catch (e) {
      console.error('[Lock-in] Invalid caption URL:', url, e);
      throw new Error('Invalid caption URL');
    }

    const response = await fetchWithRetry(url, {
      method: 'GET',
      credentials: 'include',
      mode: 'cors',
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
