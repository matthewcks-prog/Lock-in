/**
 * Session management helpers (tab ID + session restore/clear).
 */
(function () {
  function createSessionManager({ Messaging, Logger, stateStore, origin }) {
    const log = Logger || { debug: () => {}, error: console.error };
    let currentTabId = null;
    const MESSAGE_TYPES = (Messaging && Messaging.types) || {
      GET_TAB_ID: 'GET_TAB_ID',
      GET_SESSION: 'GET_SESSION',
      CLEAR_SESSION: 'CLEAR_SESSION',
    };

    async function sendMessage(type, payload) {
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

    async function getTabId() {
      if (!Messaging || !chrome.runtime) return null;

      try {
        const response = await sendMessage(MESSAGE_TYPES.GET_TAB_ID);
        const tabId = response?.data?.tabId ?? response?.tabId;
        if (typeof tabId === 'number') {
          currentTabId = tabId;
          log.debug('Tab ID:', currentTabId);
          return currentTabId;
        }
      } catch (error) {
        log.error('Failed to get tab ID:', error);
      }

      return currentTabId;
    }

    async function restoreSession() {
      if (!Messaging || !chrome.runtime) return;
      if (!currentTabId) {
        await getTabId();
      }
      if (!currentTabId) return;

      try {
        const response = await sendMessage(MESSAGE_TYPES.GET_SESSION);
        if (response && response.ok === false) return;

        const session = response?.data?.session || response?.session;
        if (!session || !session.isActive) return;

        if (session.origin && origin && session.origin !== origin) {
          log.debug('Origin changed, not restoring session');
          await clearSession();
          return;
        }

        if (session.isClosed) {
          log.debug('Session was closed by user');
          return;
        }

        stateStore.setPendingPrefill(session.selection || '');
        stateStore.setMode(session.mode || 'explain');

        if (session.chatId) {
          await stateStore.setChatId(session.chatId);
        }

        if (session.selection) {
          await stateStore.setSidebarOpen(true);
        }
      } catch (error) {
        log.error('Failed to load session:', error);
      }
    }

    async function clearSession() {
      if (!Messaging || !chrome.runtime) return;

      try {
        await sendMessage(MESSAGE_TYPES.CLEAR_SESSION);
      } catch (error) {
        log.error('Failed to clear session:', error);
      }
    }

    return {
      getTabId,
      restoreSession,
      clearSession,
      getCurrentTabId: () => currentTabId,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createSessionManager = createSessionManager;
})();
