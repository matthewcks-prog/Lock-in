/**
 * Content script state store with persistence and storage syncing.
 * Keeps global state in one place so the orchestrator stays thin.
 */
(function () {
  const DEFAULT_PREFS = { preferredLanguage: 'en' };

  function createStoreKeys(storage) {
    const keys = (storage && storage.STORAGE_KEYS) || {};
    return {
      HIGHLIGHTING_KEY: keys.HIGHLIGHTING_ENABLED || 'highlightingEnabled',
      SIDEBAR_OPEN_KEY: keys.SIDEBAR_IS_OPEN || 'lockin_sidebar_isOpen',
      SIDEBAR_ACTIVE_TAB_KEY: keys.SIDEBAR_ACTIVE_TAB || 'lockin_sidebar_activeTab',
      CHAT_ID_STORAGE_KEY: keys.CURRENT_CHAT_ID || 'lockinCurrentChatId',
    };
  }

  function createStateSnapshotApi(state, subscribers) {
    const getSnapshot = () => ({ ...state });
    const notify = () => {
      const snapshot = getSnapshot();
      subscribers.forEach((cb) => cb(snapshot));
    };
    const subscribe = (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    };
    return { getSnapshot, notify, subscribe };
  }

  function createChatIdActions({ storage, log, state, keys, notify }) {
    const loadChatId = async () => {
      if (!storage) {
        state.currentChatId = null;
        return null;
      }
      try {
        const data = await storage.getLocal(keys.CHAT_ID_STORAGE_KEY);
        state.currentChatId = data[keys.CHAT_ID_STORAGE_KEY] || null;
      } catch (error) {
        log.warn('Failed to load chat ID:', error);
        state.currentChatId = null;
      }
      return state.currentChatId;
    };

    const setChatId = async (chatId) => {
      state.currentChatId = chatId || null;
      if (storage) {
        try {
          if (!chatId) await storage.removeLocal(keys.CHAT_ID_STORAGE_KEY);
          else await storage.setLocal(keys.CHAT_ID_STORAGE_KEY, chatId);
        } catch (error) {
          log.warn('Failed to save chat ID:', error);
        }
      }
      notify();
    };

    return { loadChatId, setChatId };
  }

  function createSidebarActions({ storage, log, state, keys, notify }) {
    const setSidebarOpen = async (isOpen) => {
      state.isSidebarOpen = !!isOpen;
      if (storage) {
        try {
          await storage.set({ [keys.SIDEBAR_OPEN_KEY]: state.isSidebarOpen });
        } catch (error) {
          log.warn('Failed to save sidebar state:', error);
        }
      }
      notify();
    };

    const setActiveTab = (tabId) => {
      if (typeof tabId !== 'string') return;
      state.currentActiveTab = tabId;
      if (storage) {
        storage
          .set({ [keys.SIDEBAR_ACTIVE_TAB_KEY]: state.currentActiveTab })
          .catch((error) => log.warn('Failed to save active tab:', error));
      }
      notify();
    };

    return { setSidebarOpen, setActiveTab };
  }

  function createPreferenceActions(state, notify) {
    const setPendingPrefill = (text) => {
      state.pendingPrefill = typeof text === 'string' ? text : '';
      notify();
    };
    const clearPendingPrefill = () => {
      if (!state.pendingPrefill) return;
      state.pendingPrefill = '';
      notify();
    };
    const setPreferences = (preferences) => {
      state.sessionPreferences = {
        ...state.sessionPreferences,
        ...(preferences || {}),
      };
      notify();
    };
    return { setPendingPrefill, clearPendingPrefill, setPreferences };
  }

  function createSyncActions({ storage, keys, state, notify }) {
    let unsubscribeStorage = null;

    const handleStorageChanges = (changes, areaName) => {
      if (areaName === 'sync' && changes[keys.HIGHLIGHTING_KEY]) {
        state.highlightingEnabled = changes[keys.HIGHLIGHTING_KEY].newValue !== false;
      }
      if (areaName === 'sync' && changes[keys.SIDEBAR_OPEN_KEY]) {
        state.isSidebarOpen = changes[keys.SIDEBAR_OPEN_KEY].newValue === true;
      }
      if (areaName === 'sync' && changes[keys.SIDEBAR_ACTIVE_TAB_KEY]) {
        if (typeof changes[keys.SIDEBAR_ACTIVE_TAB_KEY].newValue === 'string') {
          state.currentActiveTab = changes[keys.SIDEBAR_ACTIVE_TAB_KEY].newValue;
        }
      }
      if (areaName === 'local' && changes[keys.CHAT_ID_STORAGE_KEY]) {
        state.currentChatId = changes[keys.CHAT_ID_STORAGE_KEY].newValue || null;
      }
      notify();
    };

    const stopSync = () => {
      if (!unsubscribeStorage) return;
      unsubscribeStorage();
      unsubscribeStorage = null;
    };

    const startSync = () => {
      if (!storage || !storage.onChanged) return () => {};
      stopSync();
      unsubscribeStorage = storage.onChanged(handleStorageChanges);
      return unsubscribeStorage;
    };

    return { startSync, stopSync };
  }

  async function loadInitialState({ storage, log, state, keys, notify, loadChatId }) {
    if (storage) {
      try {
        const data = await storage.get([
          keys.HIGHLIGHTING_KEY,
          keys.SIDEBAR_OPEN_KEY,
          keys.SIDEBAR_ACTIVE_TAB_KEY,
        ]);
        state.highlightingEnabled = data[keys.HIGHLIGHTING_KEY] !== false;
        if (typeof data[keys.SIDEBAR_OPEN_KEY] === 'boolean') {
          state.isSidebarOpen = data[keys.SIDEBAR_OPEN_KEY];
        }
        if (typeof data[keys.SIDEBAR_ACTIVE_TAB_KEY] === 'string') {
          state.currentActiveTab = data[keys.SIDEBAR_ACTIVE_TAB_KEY];
        }
      } catch (error) {
        log.warn('Failed to load toggle state:', error);
      }
      await loadChatId();
    }
    notify();
    return { ...state };
  }

  function createStateStoreDependencies({ storage, log, state, keys, snapshotApi }) {
    return {
      chatActions: createChatIdActions({
        storage,
        log,
        state,
        keys,
        notify: snapshotApi.notify,
      }),
      sidebarActions: createSidebarActions({
        storage,
        log,
        state,
        keys,
        notify: snapshotApi.notify,
      }),
      preferenceActions: createPreferenceActions(state, snapshotApi.notify),
      syncActions: createSyncActions({ storage, keys, state, notify: snapshotApi.notify }),
    };
  }

  function createStateStore({ Storage, Logger }) {
    const storage = Storage;
    const log = Logger || { warn: console.warn };
    const keys = createStoreKeys(storage);
    const state = {
      highlightingEnabled: true,
      isSidebarOpen: false,
      pendingPrefill: '',
      currentChatId: null,
      currentActiveTab: 'chat',
      sessionPreferences: { ...DEFAULT_PREFS },
    };
    const subscribers = new Set();
    const snapshotApi = createStateSnapshotApi(state, subscribers);
    const { chatActions, sidebarActions, preferenceActions, syncActions } =
      createStateStoreDependencies({
        storage,
        log,
        state,
        keys,
        snapshotApi,
      });

    return {
      loadInitial: () =>
        loadInitialState({
          storage,
          log,
          state,
          keys,
          notify: snapshotApi.notify,
          loadChatId: chatActions.loadChatId,
        }),
      setSidebarOpen: sidebarActions.setSidebarOpen,
      setPendingPrefill: preferenceActions.setPendingPrefill,
      clearPendingPrefill: preferenceActions.clearPendingPrefill,
      setChatId: chatActions.setChatId,
      setActiveTab: sidebarActions.setActiveTab,
      setPreferences: preferenceActions.setPreferences,
      getSnapshot: snapshotApi.getSnapshot,
      subscribe: snapshotApi.subscribe,
      startSync: syncActions.startSync,
      stopSync: syncActions.stopSync,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createStateStore = createStateStore;
})();
