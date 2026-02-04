(() => {
  const NetworkUtils =
    typeof self !== 'undefined' && self.LockInNetworkUtils ? self.LockInNetworkUtils : null;
  const { fetchWithRetry } = NetworkUtils || {};

  const PANOPTO_RESOLVER_TIMEOUT_MS = 15000;
  const PANOPTO_RESOLVER_RANGE_HEADER = 'bytes=0-0';

  function isAuthStatus(status) {
    return status === 401 || status === 403;
  }

  async function probePanoptoMediaUrl(url, logger) {
    const started = Date.now();
    try {
      if (typeof fetchWithRetry !== 'function') {
        throw new Error('Network utilities unavailable');
      }
      const response = await fetchWithRetry(
        url,
        {
          method: 'GET',
          credentials: 'include',
          redirect: 'follow',
          headers: {
            Range: PANOPTO_RESOLVER_RANGE_HEADER,
            Accept: 'video/*,audio/*,*/*',
          },
        },
        1,
        PANOPTO_RESOLVER_TIMEOUT_MS,
      );

      const status = response.status;
      const contentType = response.headers.get('content-type') || '';
      const contentRange = response.headers.get('content-range') || '';
      const finalUrl = response.url || url;

      if (response.body && typeof response.body.cancel === 'function') {
        try {
          response.body.cancel();
        } catch {
          // Ignore stream cancel errors
        }
      }

      logger.debug('range-probe', {
        url,
        finalUrl,
        elapsedMs: Date.now() - started,
        meta: {
          status,
          contentType,
          contentRange,
        },
      });

      if (isAuthStatus(status)) {
        return {
          ok: false,
          status,
          errorCode: 'AUTH_REQUIRED',
          finalUrl,
          contentType,
        };
      }

      if (!response.ok) {
        return { ok: false, status, finalUrl, contentType };
      }

      if (contentType.toLowerCase().includes('text/html')) {
        return {
          ok: false,
          status,
          errorCode: 'AUTH_REQUIRED',
          finalUrl,
          contentType,
        };
      }

      return { ok: true, status, finalUrl, contentType };
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
