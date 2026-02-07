(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createSessionStore({ chromeClient, log, validators, prefix = 'lockin_session_' }) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    const validateSession =
      runtimeValidators?.validateSession ||
      ((value) => ({ ok: true, value: value || { chatHistory: [] } }));

    function getSessionKey(tabId) {
      return `${prefix}${tabId}`;
    }

    async function getSession(tabId) {
      if (!tabId) return null;
      const key = getSessionKey(tabId);
      try {
        const result = await chromeClient.storage.getLocal([key]);
        const session = result[key] || null;
        if (!session) return null;
        const parsed = validateSession(session);
        if (!parsed.ok) {
          log.warn('Invalid session payload from storage:', parsed.error);
          return null;
        }
        return parsed.value;
      } catch (error) {
        log.error('Failed to get session:', error);
        return null;
      }
    }

    async function saveSession(tabId, sessionData) {
      if (!tabId) return;
      const key = getSessionKey(tabId);
      const parsed = validateSession(sessionData || {});
      if (!parsed.ok) {
        log.warn('Invalid session payload, storing sanitized fallback:', parsed.error);
      }
      const safeSession = parsed.ok ? parsed.value : parsed.fallback;
      const storedSession = {
        ...(safeSession || {}),
        chatHistory: Array.isArray(safeSession?.chatHistory) ? safeSession.chatHistory : [],
        updatedAt: Date.now(),
      };

      try {
        await chromeClient.storage.setLocal({ [key]: storedSession });
      } catch (error) {
        log.error('Failed to save session:', error);
      }
    }

    async function clearSession(tabId) {
      if (!tabId) return;
      const key = getSessionKey(tabId);
      try {
        await chromeClient.storage.removeLocal(key);
      } catch (error) {
        log.error('Failed to clear session:', error);
      }
    }

    return {
      getSessionKey,
      getSession,
      saveSession,
      clearSession,
    };
  }

  registry.sessions = {
    createSessionStore,
  };
})();
