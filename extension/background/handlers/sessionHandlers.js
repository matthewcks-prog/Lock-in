(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const handlers = registry.handlers || (registry.handlers = {});

  function createSessionHandlers({ sessionStore }) {
    async function getTabIdHandler({ sender, respond }) {
      const tabId = sender?.tab?.id;
      return respond.success({ tabId });
    }

    async function getSessionHandler({ sender, respond }) {
      const tabId = sender?.tab?.id;
      const session = await sessionStore.getSession(tabId);
      return respond.success({ session });
    }

    async function saveSessionHandler({ sender, message, payload, respond }) {
      const tabId = sender?.tab?.id;
      const sessionData = message?.sessionData ?? payload?.sessionData;
      await sessionStore.saveSession(tabId, sessionData);
      return respond.success({ success: true });
    }

    async function clearSessionHandler({ sender, respond }) {
      const tabId = sender?.tab?.id;
      await sessionStore.clearSession(tabId);
      return respond.success({ success: true });
    }

    return {
      getTabId: getTabIdHandler,
      GET_TAB_ID: getTabIdHandler,
      getSession: getSessionHandler,
      GET_SESSION: getSessionHandler,
      saveSession: saveSessionHandler,
      SAVE_SESSION: saveSessionHandler,
      clearSession: clearSessionHandler,
      CLEAR_SESSION: clearSessionHandler,
    };
  }

  handlers.createSessionHandlers = createSessionHandlers;
})();
