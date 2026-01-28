(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createSessionStore({ chromeClient, log, prefix = 'lockin_session_' }) {
    function getSessionKey(tabId) {
      return `${prefix}${tabId}`;
    }

    async function getSession(tabId) {
      if (!tabId) return null;
      const key = getSessionKey(tabId);
      try {
        const result = await chromeClient.storage.getLocal([key]);
        return result[key] || null;
      } catch (error) {
        log.error('Failed to get session:', error);
        return null;
      }
    }

    async function saveSession(tabId, sessionData) {
      if (!tabId) return;
      const key = getSessionKey(tabId);
      const storedSession = {
        ...(sessionData || {}),
        chatHistory: Array.isArray(sessionData?.chatHistory) ? sessionData.chatHistory : [],
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
