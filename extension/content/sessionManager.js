/**
 * Session management helpers (tab ID + session restore/clear).
 */
(function () {
  function resolveMessageTypes(Messaging) {
    return (
      (Messaging && Messaging.types) || {
        GET_TAB_ID: 'GET_TAB_ID',
        GET_SESSION: 'GET_SESSION',
        CLEAR_SESSION: 'CLEAR_SESSION',
      }
    );
  }

  async function sendMessage({ Messaging, log, type, payload }) {
    if (!Messaging || !chrome.runtime) return null;
    try {
      if (typeof Messaging.send === 'function') {
        return await Messaging.send(type, payload);
      }
      if (typeof Messaging.sendToBackground === 'function') {
        return await Messaging.sendToBackground({ type, payload });
      }
      if (typeof Messaging.sendMessage === 'function') {
        return await Messaging.sendMessage({ type, payload });
      }
    } catch (error) {
      log.error('Messaging failed:', error);
    }
    return null;
  }

  function getSessionFromResponse(response) {
    return response?.data?.session || response?.session;
  }

  async function applySession({ stateStore, session }) {
    stateStore.setPendingPrefill(session.selection || '');
    if (session.chatId) {
      await stateStore.setChatId(session.chatId);
    }
    if (session.selection) {
      await stateStore.setSidebarOpen(true);
    }
  }

  async function shouldSkipSession({ session, origin, log, clearSession }) {
    if (!session || !session.isActive) {
      return true;
    }
    if (session.origin && origin && session.origin !== origin) {
      log.debug('Origin changed, not restoring session');
      await clearSession();
      return true;
    }
    if (session.isClosed) {
      log.debug('Session was closed by user');
      return true;
    }
    return false;
  }

  function createGetTabId({ Messaging, log, messageTypes, state }) {
    return async () => {
      if (!Messaging || !chrome.runtime) return null;
      try {
        const response = await sendMessage({ Messaging, log, type: messageTypes.GET_TAB_ID });
        const tabId = response?.data?.tabId ?? response?.tabId;
        if (typeof tabId === 'number') {
          state.currentTabId = tabId;
          log.debug('Tab ID:', state.currentTabId);
          return state.currentTabId;
        }
      } catch (error) {
        log.error('Failed to get tab ID:', error);
      }
      return state.currentTabId;
    };
  }

  function createClearSession({ Messaging, log, messageTypes }) {
    return async () => {
      if (!Messaging || !chrome.runtime) return;
      try {
        await sendMessage({ Messaging, log, type: messageTypes.CLEAR_SESSION });
      } catch (error) {
        log.error('Failed to clear session:', error);
      }
    };
  }

  function createRestoreSession({
    Messaging,
    log,
    messageTypes,
    origin,
    stateStore,
    ensureTabId,
    clearSession,
  }) {
    return async () => {
      if (!Messaging || !chrome.runtime) return;
      const tabId = await ensureTabId();
      if (!tabId) return;
      try {
        const response = await sendMessage({ Messaging, log, type: messageTypes.GET_SESSION });
        if (response && response.ok === false) return;
        const session = getSessionFromResponse(response);
        if (await shouldSkipSession({ session, origin, log, clearSession })) return;
        await applySession({ stateStore, session });
      } catch (error) {
        log.error('Failed to load session:', error);
      }
    };
  }

  function createSessionManager({ Messaging, Logger, stateStore, origin }) {
    const log = Logger || { debug: () => {}, error: console.error };
    const messageTypes = resolveMessageTypes(Messaging);
    const state = { currentTabId: null };
    const getTabId = createGetTabId({ Messaging, log, messageTypes, state });

    const ensureTabId = async () => {
      if (!state.currentTabId) {
        await getTabId();
      }
      return state.currentTabId;
    };
    const clearSession = createClearSession({ Messaging, log, messageTypes });
    const restoreSession = createRestoreSession({
      Messaging,
      log,
      messageTypes,
      origin,
      stateStore,
      ensureTabId,
      clearSession,
    });

    return {
      getTabId,
      restoreSession,
      clearSession,
      getCurrentTabId: () => state.currentTabId,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createSessionManager = createSessionManager;
})();
