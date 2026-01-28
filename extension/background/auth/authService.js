(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

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

  function createAuthService({ chromeClient, config, log }) {
    let refreshInFlight = null;

    async function storageGet(key) {
      return chromeClient.storage.getSync([key]);
    }

    async function storageSet(data) {
      return chromeClient.storage.setSync(data);
    }

    async function storageRemove(key) {
      return chromeClient.storage.removeSync(key);
    }

    async function refreshAccessToken(session) {
      const supabaseUrl = config.getSupabaseUrl();
      const anonKey = config.getSupabaseAnonKey();
      if (!supabaseUrl || !anonKey || !session?.refreshToken) {
        return null;
      }

      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });

      if (!response.ok) {
        await storageRemove(config.getSessionStorageKey());
        return null;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        log.error('Failed to parse refresh token response:', error);
        return null;
      }

      if (!payload?.access_token) {
        return null;
      }

      const expiresIn = Number(payload.expires_in) || 3600;
      const nextSession = {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || session.refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        tokenType: payload.token_type || session.tokenType || 'bearer',
        user: payload.user || session.user || null,
      };

      await storageSet({ [config.getSessionStorageKey()]: nextSession });
      return nextSession.accessToken;
    }

    async function getAuthToken() {
      const key = config.getSessionStorageKey();
      try {
        const result = await storageGet(key);
        const session = normalizeStoredSession(result[key]);
        if (!session?.accessToken) return null;

        const bufferMs = config.getTokenExpiryBufferMs();
        const expiresAt = session.expiresAt || 0;
        if (expiresAt && expiresAt - bufferMs > Date.now()) {
          return session.accessToken;
        }

        if (!session.refreshToken) {
          return null;
        }

        if (!refreshInFlight) {
          refreshInFlight = refreshAccessToken(session).finally(() => {
            refreshInFlight = null;
          });
        }

        const refreshed = await refreshInFlight;
        return refreshed || null;
      } catch (error) {
        log.error('Failed to read auth session:', error);
        return null;
      }
    }

    return {
      getAuthToken,
    };
  }

  registry.auth = {
    createAuthService,
    normalizeStoredSession,
  };
})();
