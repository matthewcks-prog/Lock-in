(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const AUTH_REFRESH_MAX_RETRIES = 2;
  const AUTH_REFRESH_TIMEOUT_MS = 10000;
  const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 3600;

  function normalizeStoredSession(session) {
    if (!session || typeof session !== 'object') return null;
    return {
      accessToken: session.accessToken || session.access_token || null,
      refreshToken: session.refreshToken || session.refresh_token || null,
      expiresAt: Number(session.expiresAt || session.expires_at || 0),
      tokenType: session.tokenType || session.token_type || 'bearer',
      user: session.user || null,
    };
  }

  function createRuntimeValidators(validators) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    return {
      validateAuthSession:
        runtimeValidators?.validateAuthSession || ((value) => ({ ok: true, value: value || {} })),
      validateSupabaseTokenResponse:
        runtimeValidators?.validateSupabaseTokenResponse ||
        ((value) => ({ ok: true, value: value || {} })),
    };
  }

  function createStorageApi(chromeClient) {
    return {
      get: (key) => chromeClient.storage.getSync([key]),
      set: (data) => chromeClient.storage.setSync(data),
      remove: (key) => chromeClient.storage.removeSync(key),
    };
  }

  function createRefreshRequest(config, session) {
    const supabaseUrl = config.getSupabaseUrl();
    const anonKey = config.getSupabaseAnonKey();
    if (!supabaseUrl || !anonKey || !session?.refreshToken) {
      return null;
    }
    return {
      url: `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      requestOptions: {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      },
    };
  }

  async function parseRefreshPayload(response, validateSupabaseTokenResponse, log) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      log.error('Failed to parse refresh token response:', error);
      return null;
    }

    const parsedPayload = validateSupabaseTokenResponse(payload);
    if (!parsedPayload.ok) {
      log.error('Invalid Supabase token response:', parsedPayload.error);
      return null;
    }
    return parsedPayload.value;
  }

  function buildNextSession(payload, previousSession) {
    const expiresIn = Number(payload.expires_in) || DEFAULT_TOKEN_EXPIRES_IN_SECONDS;
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || previousSession.refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      tokenType: payload.token_type || previousSession.tokenType || 'bearer',
      user: payload.user || previousSession.user || null,
    };
  }

  function createRefreshAccessToken({
    config,
    log,
    networkUtils,
    storage,
    validateAuthSession,
    validateSupabaseTokenResponse,
  }) {
    return async function refreshAccessToken(session) {
      const request = createRefreshRequest(config, session);
      if (!request) return null;

      const fetchWithRetry = networkUtils?.fetchWithRetry;
      if (typeof fetchWithRetry !== 'function') {
        log.error('Network utilities unavailable for auth refresh');
        return null;
      }

      const response = await fetchWithRetry(
        request.url,
        request.requestOptions,
        AUTH_REFRESH_MAX_RETRIES,
        AUTH_REFRESH_TIMEOUT_MS,
      );
      if (!response.ok) {
        await storage.remove(config.getSessionStorageKey());
        return null;
      }

      const payload = await parseRefreshPayload(response, validateSupabaseTokenResponse, log);
      if (!payload?.access_token) {
        return null;
      }

      const nextSession = buildNextSession(payload, session);
      const validatedSession = validateAuthSession(nextSession);
      if (!validatedSession.ok) {
        log.error('Invalid auth session payload:', validatedSession.error);
        return null;
      }

      await storage.set({ [config.getSessionStorageKey()]: validatedSession.value });
      return nextSession.accessToken;
    };
  }

  function shouldReuseAccessToken(session, config) {
    const expiresAt = session.expiresAt || 0;
    const bufferMs = config.getTokenExpiryBufferMs();
    return Boolean(expiresAt && expiresAt - bufferMs > Date.now());
  }

  function createGetAuthToken({
    config,
    log,
    storage,
    validateAuthSession,
    refreshState,
    refreshAccessToken,
  }) {
    return async function getAuthToken() {
      const key = config.getSessionStorageKey();
      try {
        const result = await storage.get(key);
        const session = normalizeStoredSession(result[key]);
        const validated = validateAuthSession(session || {});
        if (!validated.ok) {
          log.error('Invalid auth session in storage:', validated.error);
          return null;
        }

        const safeSession = validated.value;
        if (!safeSession?.accessToken) return null;
        if (shouldReuseAccessToken(safeSession, config)) return safeSession.accessToken;
        if (!safeSession.refreshToken) return null;

        if (!refreshState.inFlight) {
          refreshState.inFlight = refreshAccessToken(safeSession).finally(() => {
            refreshState.inFlight = null;
          });
        }
        return (await refreshState.inFlight) || null;
      } catch (error) {
        log.error('Failed to read auth session:', error);
        return null;
      }
    };
  }

  function createAuthService({ chromeClient, config, log, networkUtils, validators }) {
    const runtimeValidators = createRuntimeValidators(validators);
    const storage = createStorageApi(chromeClient);
    const refreshState = { inFlight: null };
    const refreshAccessToken = createRefreshAccessToken({
      config,
      log,
      networkUtils,
      storage,
      validateAuthSession: runtimeValidators.validateAuthSession,
      validateSupabaseTokenResponse: runtimeValidators.validateSupabaseTokenResponse,
    });
    const getAuthToken = createGetAuthToken({
      config,
      log,
      storage,
      validateAuthSession: runtimeValidators.validateAuthSession,
      refreshState,
      refreshAccessToken,
    });
    return { getAuthToken };
  }

  registry.auth = {
    createAuthService,
    normalizeStoredSession,
  };
})();
