/**
 * Session management helpers (tab ID + session restore/clear).
 */
(function () {
  function createSessionManager({ Messaging, Logger, stateStore, origin }) {
    const log = Logger || { debug: () => {}, error: console.error };
    let currentTabId = null;

    async function getTabId() {
      if (!Messaging || !chrome.runtime) return null;

      try {
        const message = Messaging.createMessage(Messaging.MESSAGE_TYPES.GET_TAB_ID);
        const response = await Messaging.sendMessage(message);
        if (response.ok && response.data) {
          currentTabId = response.data.tabId;
          log.debug("Tab ID:", currentTabId);
          return currentTabId;
        }
      } catch (error) {
        log.error("Failed to get tab ID:", error);
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
        const message = Messaging.createMessage(Messaging.MESSAGE_TYPES.GET_SESSION);
        const response = await Messaging.sendMessage(message);
        if (!response.ok) return;

        const session = response.data?.session;
        if (!session || !session.isActive) return;

        if (session.origin && origin && session.origin !== origin) {
          log.debug("Origin changed, not restoring session");
          await clearSession();
          return;
        }

        if (session.isClosed) {
          log.debug("Session was closed by user");
          return;
        }

        stateStore.setSelection(session.selection || "");
        stateStore.setMode(session.mode || "explain");
        stateStore.setPreferences({
          preferredLanguage: session.targetLanguage || "en",
          difficultyLevel: session.difficultyLevel || "highschool",
        });

        if (session.chatId) {
          await stateStore.setChatId(session.chatId);
        }

        if (session.selection) {
          await stateStore.setSidebarOpen(true);
        }
      } catch (error) {
        log.error("Failed to load session:", error);
      }
    }

    async function clearSession() {
      if (!Messaging || !chrome.runtime) return;

      try {
        const message = Messaging.createMessage(Messaging.MESSAGE_TYPES.CLEAR_SESSION);
        await Messaging.sendMessage(message);
      } catch (error) {
        log.error("Failed to clear session:", error);
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
