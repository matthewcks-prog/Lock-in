(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createChromeClient(chromeApi) {
    function assertChrome(feature) {
      if (!chromeApi) {
        throw new Error(`Chrome API not available for ${feature}`);
      }
    }

    function storageGet(area, keys) {
      assertChrome(`storage.${area}.get`);
      return new Promise((resolve, reject) => {
        try {
          chromeApi.storage[area].get(keys, (result) => {
            const error = chromeApi.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(result || {});
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    function storageSet(area, data) {
      assertChrome(`storage.${area}.set`);
      return new Promise((resolve, reject) => {
        try {
          chromeApi.storage[area].set(data, () => {
            const error = chromeApi.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    function storageRemove(area, keys) {
      assertChrome(`storage.${area}.remove`);
      return new Promise((resolve, reject) => {
        try {
          chromeApi.storage[area].remove(keys, () => {
            const error = chromeApi.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    function sendTabMessage(tabId, message) {
      assertChrome('tabs.sendMessage');
      return new Promise((resolve, reject) => {
        try {
          chromeApi.tabs.sendMessage(tabId, message, (response) => {
            const error = chromeApi.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(response);
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    return {
      raw: chromeApi,
      runtime: chromeApi?.runtime,
      contextMenus: chromeApi?.contextMenus,
      tabs: chromeApi?.tabs,
      webNavigation: chromeApi?.webNavigation,
      storage: {
        getSync: (keys) => storageGet('sync', keys),
        setSync: (data) => storageSet('sync', data),
        removeSync: (keys) => storageRemove('sync', keys),
        getLocal: (keys) => storageGet('local', keys),
        setLocal: (data) => storageSet('local', data),
        removeLocal: (keys) => storageRemove('local', keys),
      },
      sendTabMessage,
    };
  }

  registry.chromeClient = {
    createChromeClient,
  };
})();
