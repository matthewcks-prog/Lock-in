/**
 * Content script state store with persistence and storage syncing.
 * Keeps global state in one place so the orchestrator stays thin.
 */
(function () {
  const DEFAULT_MODE = 'explain';
  const DEFAULT_PREFS = {
    preferredLanguage: 'en',
  };

  function createStateStore({ Storage, Logger }) {
    const storage = Storage;
    const log = Logger || { warn: console.warn };
    const keys = (storage && storage.STORAGE_KEYS) || {};
    const SIDEBAR_OPEN_KEY = keys.SIDEBAR_IS_OPEN || 'lockin_sidebar_isOpen';
    const SIDEBAR_ACTIVE_TAB_KEY = keys.SIDEBAR_ACTIVE_TAB || 'lockin_sidebar_activeTab';
    const CHAT_ID_STORAGE_KEY = keys.CURRENT_CHAT_ID || 'lockinCurrentChatId';
    const MODE_KEY = keys.ACTIVE_MODE || 'lockinActiveMode';
    const MODE_PREF_KEY = keys.MODE_PREFERENCE || 'modePreference';
    const DEFAULT_MODE_KEY = keys.DEFAULT_MODE || 'defaultMode';
    const LAST_USED_MODE_KEY = keys.LAST_USED_MODE || 'lastUsedMode';
    const HIGHLIGHTING_KEY = keys.HIGHLIGHTING_ENABLED || 'highlightingEnabled';

    const state = {
      highlightingEnabled: true,
      currentMode: DEFAULT_MODE,
      isSidebarOpen: false,
      pendingPrefill: '',
      currentChatId: null,
      currentActiveTab: 'chat',
      sessionPreferences: { ...DEFAULT_PREFS },
    };

    const subscribers = new Set();
    let unsubscribeStorage = null;

    function getSnapshot() {
      return { ...state };
    }

    function notify() {
      const snapshot = getSnapshot();
      subscribers.forEach((cb) => cb(snapshot));
    }

    function subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }

    async function loadInitial() {
      if (storage) {
        try {
          const data = await storage.get([
            HIGHLIGHTING_KEY,
            SIDEBAR_OPEN_KEY,
            SIDEBAR_ACTIVE_TAB_KEY,
          ]);
          state.highlightingEnabled = data[HIGHLIGHTING_KEY] !== false;
          if (typeof data[SIDEBAR_OPEN_KEY] === 'boolean') {
            state.isSidebarOpen = data[SIDEBAR_OPEN_KEY];
          }
          if (typeof data[SIDEBAR_ACTIVE_TAB_KEY] === 'string') {
            state.currentActiveTab = data[SIDEBAR_ACTIVE_TAB_KEY];
          }
        } catch (error) {
          log.warn('Failed to load toggle state:', error);
        }

        await loadMode();
        await loadChatId();
      }

      notify();
      return getSnapshot();
    }

    async function loadMode() {
      if (!storage) return state.currentMode;
      try {
        const data = await storage.get(MODE_KEY);
        if (data[MODE_KEY]) {
          state.currentMode = data[MODE_KEY];
        }
      } catch (error) {
        log.warn('Failed to load mode:', error);
      }
      return state.currentMode;
    }

    async function determineDefaultMode() {
      if (!storage) {
        state.currentMode = DEFAULT_MODE;
        notify();
        return state.currentMode;
      }

      try {
        const data = await storage.get([
          MODE_PREF_KEY,
          DEFAULT_MODE_KEY,
          LAST_USED_MODE_KEY,
          MODE_KEY,
        ]);

        if (data[MODE_KEY]) {
          state.currentMode = data[MODE_KEY];
        } else {
          const modePref = data[MODE_PREF_KEY] || 'fixed';
          if (modePref === 'lastUsed' && data[LAST_USED_MODE_KEY]) {
            state.currentMode = data[LAST_USED_MODE_KEY];
          } else {
            state.currentMode = data[DEFAULT_MODE_KEY] || DEFAULT_MODE;
          }
        }
      } catch (error) {
        log.warn('Mode determination error:', error);
        state.currentMode = DEFAULT_MODE;
      }

      notify();
      return state.currentMode;
    }

    function setMode(mode) {
      state.currentMode = mode || DEFAULT_MODE;
      notify();
    }

    async function persistMode(mode) {
      state.currentMode = mode || DEFAULT_MODE;
      if (!storage) {
        notify();
        return state.currentMode;
      }

      try {
        const data = await storage.get(MODE_PREF_KEY);
        if (data[MODE_PREF_KEY] === 'lastUsed') {
          await storage.set({ [LAST_USED_MODE_KEY]: state.currentMode });
        }
        await storage.set({ [MODE_KEY]: state.currentMode });
      } catch (error) {
        log.warn('Storage access error:', error);
      }

      notify();
      return state.currentMode;
    }

    async function loadChatId() {
      if (!storage) {
        state.currentChatId = null;
        return null;
      }
      try {
        const data = await storage.getLocal(CHAT_ID_STORAGE_KEY);
        state.currentChatId = data[CHAT_ID_STORAGE_KEY] || null;
      } catch (error) {
        log.warn('Failed to load chat ID:', error);
        state.currentChatId = null;
      }
      return state.currentChatId;
    }

    async function setChatId(chatId) {
      state.currentChatId = chatId || null;
      if (!storage) {
        notify();
        return;
      }

      try {
        if (!chatId) {
          await storage.removeLocal(CHAT_ID_STORAGE_KEY);
        } else {
          await storage.setLocal(CHAT_ID_STORAGE_KEY, chatId);
        }
      } catch (error) {
        log.warn('Failed to save chat ID:', error);
      }

      notify();
    }

    async function setSidebarOpen(isOpen) {
      state.isSidebarOpen = !!isOpen;
      if (storage) {
        try {
          await storage.set({ [SIDEBAR_OPEN_KEY]: state.isSidebarOpen });
        } catch (error) {
          log.warn('Failed to save sidebar state:', error);
        }
      }
      notify();
    }

    function setPendingPrefill(text) {
      state.pendingPrefill = typeof text === 'string' ? text : '';
      notify();
    }

    function clearPendingPrefill() {
      if (!state.pendingPrefill) return;
      state.pendingPrefill = '';
      notify();
    }

    function setActiveTab(tabId) {
      if (typeof tabId === 'string') {
        state.currentActiveTab = tabId;
        if (storage) {
          storage
            .set({ [SIDEBAR_ACTIVE_TAB_KEY]: state.currentActiveTab })
            .catch((error) => log.warn('Failed to save active tab:', error));
        }
        notify();
      }
    }

    function setPreferences(preferences) {
      state.sessionPreferences = {
        ...state.sessionPreferences,
        ...(preferences || {}),
      };
      notify();
    }

    function handleStorageChanges(changes, areaName) {
      if (areaName === 'sync' && changes[HIGHLIGHTING_KEY]) {
        state.highlightingEnabled = changes[HIGHLIGHTING_KEY].newValue !== false;
      }

      if (areaName === 'sync' && changes[MODE_KEY]) {
        state.currentMode = changes[MODE_KEY].newValue;
      }

      if (areaName === 'sync' && changes[SIDEBAR_OPEN_KEY]) {
        state.isSidebarOpen = changes[SIDEBAR_OPEN_KEY].newValue === true;
      }

      if (areaName === 'sync' && changes[SIDEBAR_ACTIVE_TAB_KEY]) {
        if (typeof changes[SIDEBAR_ACTIVE_TAB_KEY].newValue === 'string') {
          state.currentActiveTab = changes[SIDEBAR_ACTIVE_TAB_KEY].newValue;
        }
      }

      if (areaName === 'local' && changes[CHAT_ID_STORAGE_KEY]) {
        state.currentChatId = changes[CHAT_ID_STORAGE_KEY].newValue || null;
      }

      notify();
    }

    function startSync() {
      if (!storage || !storage.onChanged) return () => {};
      stopSync();
      unsubscribeStorage = storage.onChanged(handleStorageChanges);
      return unsubscribeStorage;
    }

    function stopSync() {
      if (unsubscribeStorage) {
        unsubscribeStorage();
        unsubscribeStorage = null;
      }
    }

    return {
      loadInitial,
      determineDefaultMode,
      persistMode,
      setMode,
      setSidebarOpen,
      setPendingPrefill,
      clearPendingPrefill,
      setChatId,
      setActiveTab,
      setPreferences,
      getSnapshot,
      subscribe,
      startSync,
      stopSync,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createStateStore = createStateStore;
})();
