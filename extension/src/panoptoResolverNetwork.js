(() => {
  const NetworkUtils =
    typeof self !== 'undefined' && self.LockInNetworkUtils ? self.LockInNetworkUtils : null;
  const { fetchWithRetry } = NetworkUtils || {};

  const PANOPTO_RESOLVER_TIMEOUT_MS = 15000;
  const PANOPTO_RESOLVER_RANGE_HEADER = 'bytes=0-0';
  const AUTH_STATUS_UNAUTHORIZED = 401;
  const AUTH_STATUS_FORBIDDEN = 403;

  function isAuthStatus(status) {
    return status === AUTH_STATUS_UNAUTHORIZED || status === AUTH_STATUS_FORBIDDEN;
  }

  function buildProbeRequestOptions() {
    return {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      headers: {
        Range: PANOPTO_RESOLVER_RANGE_HEADER,
        Accept: 'video/*,audio/*,*/*',
      },
    };
  }

  function readProbeMetadata(response, fallbackUrl) {
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      contentRange: response.headers.get('content-range') || '',
      finalUrl: response.url || fallbackUrl,
    };
  }

  function cancelResponseBody(response) {
    if (!response.body || typeof response.body.cancel !== 'function') {
      return;
    }
    try {
      response.body.cancel();
    } catch {
      // Ignore stream cancel errors
    }
  }

  function logProbeResult({ logger, url, started, status, finalUrl, contentType, contentRange }) {
    logger.debug('range-probe', {
      url,
      finalUrl,
      elapsedMs: Date.now() - started,
      meta: { status, contentType, contentRange },
    });
  }

  function buildProbeFailureResult({ status, finalUrl, contentType }) {
    if (isAuthStatus(status)) {
      return { ok: false, status, errorCode: 'AUTH_REQUIRED', finalUrl, contentType };
    }
    return { ok: false, status, finalUrl, contentType };
  }

  function buildProbeResultFromResponse({ response, url }) {
    const metadata = readProbeMetadata(response, url);
    const { status, contentType, finalUrl } = metadata;
    if (response.ok && !contentType.toLowerCase().includes('text/html')) {
      return { ok: true, status, finalUrl, contentType };
    }
    if (contentType.toLowerCase().includes('text/html')) {
      return { ok: false, status, errorCode: 'AUTH_REQUIRED', finalUrl, contentType };
    }
    return buildProbeFailureResult({ status, finalUrl, contentType });
  }

  async function probePanoptoMediaUrl(url, logger) {
    const started = Date.now();
    try {
      if (typeof fetchWithRetry !== 'function') {
        throw new Error('Network utilities unavailable');
      }
      const response = await fetchWithRetry(
        url,
        buildProbeRequestOptions(),
        1,
        PANOPTO_RESOLVER_TIMEOUT_MS,
      );
      const metadata = readProbeMetadata(response, url);
      cancelResponseBody(response);
      logProbeResult({ logger, url, started, ...metadata });
      return buildProbeResultFromResponse({ response, url });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug('range-probe', {
        status: 'error',
        url,
        elapsedMs: Date.now() - started,
        meta: { error: message },
      });
      return { ok: false, error: message };
    }
  }

  if (typeof self !== 'undefined') {
    self.LockInPanoptoResolverNetwork = {
      isAuthStatus,
      probePanoptoMediaUrl,
    };
  }
})();
