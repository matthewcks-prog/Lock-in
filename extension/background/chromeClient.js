(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createCallbackPromise(chromeApi, executor) {
    return new Promise((resolve, reject) => {
      try {
        executor((result) => {
          const error = chromeApi.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function createStorageMethod(chromeApi, assertChrome, area, method) {
    const feature = `storage.${area}.${method}`;
    return (value) => {
      assertChrome(feature);
      return createCallbackPromise(chromeApi, (done) => {
        if (method === 'get') {
          chromeApi.storage[area].get(value, (result) => done(result || {}));
          return;
        }
        chromeApi.storage[area][method](value, () => done(undefined));
      });
    };
  }

  function createStorageApi(chromeApi, assertChrome) {
    const storageGetSync = createStorageMethod(chromeApi, assertChrome, 'sync', 'get');
    const storageSetSync = createStorageMethod(chromeApi, assertChrome, 'sync', 'set');
    const storageRemoveSync = createStorageMethod(chromeApi, assertChrome, 'sync', 'remove');
    const storageGetLocal = createStorageMethod(chromeApi, assertChrome, 'local', 'get');
    const storageSetLocal = createStorageMethod(chromeApi, assertChrome, 'local', 'set');
    const storageRemoveLocal = createStorageMethod(chromeApi, assertChrome, 'local', 'remove');
    return {
      getSync: (keys) => storageGetSync(keys),
      setSync: (data) => storageSetSync(data),
      removeSync: (keys) => storageRemoveSync(keys),
      getLocal: (keys) => storageGetLocal(keys),
      setLocal: (data) => storageSetLocal(data),
      removeLocal: (keys) => storageRemoveLocal(keys),
    };
  }

  function createSendTabMessage(chromeApi, assertChrome) {
    return (tabId, message) => {
      assertChrome('tabs.sendMessage');
      return createCallbackPromise(chromeApi, (done) => {
        chromeApi.tabs.sendMessage(tabId, message, done);
      });
    };
  }

  function createChromeClient(chromeApi) {
    function assertChrome(feature) {
      if (!chromeApi) {
        throw new Error(`Chrome API not available for ${feature}`);
      }
    }
    const storage = createStorageApi(chromeApi, assertChrome);
    const sendTabMessage = createSendTabMessage(chromeApi, assertChrome);

    return {
      raw: chromeApi,
      runtime: chromeApi?.runtime,
      contextMenus: chromeApi?.contextMenus,
      tabs: chromeApi?.tabs,
      webNavigation: chromeApi?.webNavigation,
      storage,
      sendTabMessage,
    };
  }

  registry.chromeClient = {
    createChromeClient,
  };
})();
