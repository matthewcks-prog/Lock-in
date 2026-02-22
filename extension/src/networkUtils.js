(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self,
    NetworkRetry = root.LockInNetworkRetry || null,
    HTTP_STATUS_TOO_MANY_REQUESTS = 429,
    HTTP_STATUS_UNAUTHORIZED = 401,
    HTTP_STATUS_FORBIDDEN = 403,
    HTTP_STATUS_NOT_FOUND = 404,
    HTTP_STATUS_SERVER_ERROR_MIN = 500;

  const fallbackDefaults = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    timeoutMs: 30000,
    retryableStatuses: [HTTP_STATUS_TOO_MANY_REQUESTS],
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
    if (
      response &&
      (response.status === HTTP_STATUS_UNAUTHORIZED || response.status === HTTP_STATUS_FORBIDDEN)
    ) {
      return false;
    }
    if (response && response.status === HTTP_STATUS_NOT_FOUND) {
      return false;
    }
    if (!response || response.status >= HTTP_STATUS_SERVER_ERROR_MIN) {
      return true;
    }
    if (response.status === HTTP_STATUS_TOO_MANY_REQUESTS) {
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

  function parseFetchWithRetryArgs(args) {
    const [url, options = {}, maxRetriesOrConfig, timeoutMs, overrides] = args;
    return {
      url,
      options,
      config: normalizeRetryConfig(maxRetriesOrConfig, timeoutMs, overrides),
    };
  }

  function createOnRetry(config) {
    return (
      config.onRetry ||
      ((info) => {
        console.log(
          `[Lock-in] Retry attempt ${info.attempt}/${config.maxRetries} after ${info.delayMs}ms`,
        );
      })
    );
  }

  function normalizeAttemptError(error, timeoutMs) {
    if (error?.name === 'AbortError') {
      console.warn(`[Lock-in] Request timeout after ${timeoutMs}ms`);
      return new Error(`Request timeout after ${timeoutMs}ms`);
    }
    if (error?.message === 'Failed to fetch') {
      console.warn(
        '[Lock-in] Network error: Failed to fetch. Possible causes: CORS, DNS, or network connectivity',
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  async function performFetchAttempt(url, options, config, attempt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      console.log(
        `[Lock-in] Fetching (attempt ${attempt + 1}/${config.maxRetries + 1}): ${url.substring(0, 100)}...`,
      );
      const response = await fetch(url, { ...options, signal: controller.signal });
      console.log(`[Lock-in] Response status: ${response.status} ${response.statusText}`);
      return { response };
    } catch (error) {
      console.error(`[Lock-in] Fetch error (attempt ${attempt + 1}):`, error?.message || error);
      return { error: normalizeAttemptError(error, config.timeoutMs) };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchWithLocalRetry(url, options, config) {
    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      const result = await performFetchAttempt(url, options, config, attempt);
      if (result.response) {
        lastResponse = result.response;
        if (result.response.ok || !isRetryableError(null, result.response)) {
          return result.response;
        }
        lastError = new Error(`HTTP ${result.response.status}: ${result.response.statusText}`);
      } else {
        lastError = result.error;
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

  async function fetchWithRetry(...args) {
    const { url, options, config } = parseFetchWithRetryArgs(args);
    if (NetworkRetry?.fetchWithRetry) {
      return NetworkRetry.fetchWithRetry(url, options, {
        ...config,
        context: config.context || 'fetch',
        onRetry: createOnRetry(config),
      });
    }
    return fetchWithLocalRetry(url, options, config);
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
      if (
        response.status === HTTP_STATUS_UNAUTHORIZED ||
        response.status === HTTP_STATUS_FORBIDDEN
      ) {
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
      if (
        response.status === HTTP_STATUS_UNAUTHORIZED ||
        response.status === HTTP_STATUS_FORBIDDEN
      ) {
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
      if (
        response.status === HTTP_STATUS_UNAUTHORIZED ||
        response.status === HTTP_STATUS_FORBIDDEN
      ) {
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

  async function postJson(url, body) {
    console.log('[Lock-in] postJson:', url.substring(0, 100));

    try {
      new URL(url);
    } catch (e) {
      console.error('[Lock-in] Invalid URL:', url, e);
      throw new Error('Invalid URL provided');
    }

    const response = await fetchWithRetry(url, {
      method: 'POST',
      credentials: 'include',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[Lock-in] POST failed: ${response.status} ${response.statusText}`);
      if (
        response.status === HTTP_STATUS_UNAUTHORIZED ||
        response.status === HTTP_STATUS_FORBIDDEN
      ) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    console.log(`[Lock-in] POST response: ${text.length} bytes`);
    return JSON.parse(text);
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
      postJson,
    };
  }
})();
