(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function registerLifecycleListeners({ chromeClient, sessionStore, log }) {
    if (chromeClient?.tabs?.onRemoved) {
      chromeClient.tabs.onRemoved.addListener(async (tabId) => {
        await sessionStore.clearSession(tabId);
        log.info(`Cleared session for closed tab ${tabId}`);
      });
    }

    if (chromeClient?.webNavigation?.onCommitted) {
      chromeClient.webNavigation.onCommitted.addListener(async (details) => {
        if (details.frameId !== 0) return;

        const tabId = details.tabId;
        const newOrigin = new URL(details.url).origin;

        const session = await sessionStore.getSession(tabId);

        if (session && session.origin !== newOrigin) {
          await sessionStore.clearSession(tabId);
          log.info(`Origin changed in tab ${tabId}, cleared session`);
        }
      });
    }
  }

  registry.lifecycle = {
    registerLifecycleListeners,
  };
})();
