(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createSessionValidator(validators) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    return (
      runtimeValidators?.validateSession ||
      ((value) => ({ ok: true, value: value || { chatHistory: [] } }))
    );
  }

  function buildStoredSession(validateSession, sessionData, log) {
    const parsed = validateSession(sessionData || {});
    if (!parsed.ok) {
      log.warn('Invalid session payload, storing sanitized fallback:', parsed.error);
    }
    const safeSession = parsed.ok ? parsed.value : parsed.fallback;
    return {
      ...(safeSession || {}),
      chatHistory: Array.isArray(safeSession?.chatHistory) ? safeSession.chatHistory : [],
      updatedAt: Date.now(),
    };
  }

  function createGetSession({ chromeClient, validateSession, log, getSessionKey }) {
    return async function getSession(tabId) {
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
    };
  }

  function createSaveSession({ chromeClient, validateSession, log, getSessionKey }) {
    return async function saveSession(tabId, sessionData) {
      if (!tabId) return;
      const key = getSessionKey(tabId);
      const storedSession = buildStoredSession(validateSession, sessionData, log);
      try {
        await chromeClient.storage.setLocal({ [key]: storedSession });
      } catch (error) {
        log.error('Failed to save session:', error);
      }
    };
  }

  function createClearSession({ chromeClient, log, getSessionKey }) {
    return async function clearSession(tabId) {
      if (!tabId) return;
      const key = getSessionKey(tabId);
      try {
        await chromeClient.storage.removeLocal(key);
      } catch (error) {
        log.error('Failed to clear session:', error);
      }
    };
  }

  function createSessionStore({ chromeClient, log, validators, prefix = 'lockin_session_' }) {
    const validateSession = createSessionValidator(validators);
    const getSessionKey = (tabId) => `${prefix}${tabId}`;
    const getSession = createGetSession({ chromeClient, validateSession, log, getSessionKey });
    const saveSession = createSaveSession({ chromeClient, validateSession, log, getSessionKey });
    const clearSession = createClearSession({ chromeClient, log, getSessionKey });

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
