(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function registerContextMenus({ chromeClient, log }) {
    if (!chromeClient?.runtime?.onInstalled || !chromeClient?.contextMenus) {
      log.warn('Context menus not available');
      return;
    }

    chromeClient.runtime.onInstalled.addListener(() => {
      chromeClient.contextMenus.create({
        id: 'lockin-process',
        title: 'Lock-in: Explain',
        contexts: ['selection'],
      });

      log.info('Lock-in extension installed successfully!');
    });

    chromeClient.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'lockin-process' && info.selectionText) {
        const tabId = tab?.id;
        if (typeof tabId !== 'number') return;
        chromeClient
          .sendTabMessage(tabId, {
            type: 'PREFILL_CHAT_INPUT',
            payload: { text: info.selectionText },
          })
          .catch((error) => {
            log.error('Failed to send prefill message:', error);
          });
      }
    });
  }

  registry.contextMenus = {
    registerContextMenus,
  };
})();
