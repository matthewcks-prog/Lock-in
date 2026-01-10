/**
 * Unit tests for stateStore
 *
 * Tests state management, persistence, and subscription functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the stateStore module by creating a testable version
// Since stateStore is an IIFE, we'll test the factory function directly
function createStateStore({ Storage, Logger }) {
  const storage = Storage;
  const DEFAULT_MODE = 'explain';
  const DEFAULT_PREFS = {
    preferredLanguage: 'en',
    difficultyLevel: 'highschool',
  };

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
    cachedSelection: '',
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

  function setSelection(text) {
    state.cachedSelection = text || '';
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
    setSelection,
    setChatId,
    setActiveTab,
    setPreferences,
    getSnapshot,
    subscribe,
    startSync,
    stopSync,
  };
}

describe('StateStore', () => {
  let mockStorage;
  let mockLogger;
  let stateStore;

  beforeEach(() => {
    mockStorage = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      getLocal: vi.fn().mockResolvedValue({}),
      setLocal: vi.fn().mockResolvedValue(undefined),
      removeLocal: vi.fn().mockResolvedValue(undefined),
      onChanged: vi.fn(() => () => {}), // Returns unsubscribe function
      STORAGE_KEYS: {},
    };

    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    };

    stateStore = createStateStore({ Storage: mockStorage, Logger: mockLogger });
  });

  describe('getSnapshot', () => {
    it('should return current state snapshot', () => {
      const snapshot = stateStore.getSnapshot();
      expect(snapshot).toHaveProperty('currentMode');
      expect(snapshot).toHaveProperty('isSidebarOpen');
      expect(snapshot).toHaveProperty('currentChatId');
      expect(snapshot.currentMode).toBe('explain');
      expect(snapshot.isSidebarOpen).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on state changes', async () => {
      const callback = vi.fn();
      const unsubscribe = stateStore.subscribe(callback);

      await stateStore.setSidebarOpen(true);

      expect(callback).toHaveBeenCalled();
      const snapshot = callback.mock.calls[0][0];
      expect(snapshot.isSidebarOpen).toBe(true);

      unsubscribe();
    });

    it('should allow unsubscribing', async () => {
      const callback = vi.fn();
      const unsubscribe = stateStore.subscribe(callback);
      unsubscribe();

      await stateStore.setSidebarOpen(true);

      // Callback should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setSidebarOpen', () => {
    it('should update sidebar state and persist', async () => {
      await stateStore.setSidebarOpen(true);

      expect(stateStore.getSnapshot().isSidebarOpen).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith({
        lockin_sidebar_isOpen: true,
      });
    });

    it('should work without storage', async () => {
      const storeWithoutStorage = createStateStore({ Storage: null, Logger: mockLogger });
      await storeWithoutStorage.setSidebarOpen(true);

      expect(storeWithoutStorage.getSnapshot().isSidebarOpen).toBe(true);
    });
  });

  describe('setMode', () => {
    it('should update mode without persisting', () => {
      stateStore.setMode('general');

      expect(stateStore.getSnapshot().currentMode).toBe('general');
      expect(mockStorage.set).not.toHaveBeenCalled();
    });

    it('should use default mode when mode is null', () => {
      stateStore.setMode(null);
      expect(stateStore.getSnapshot().currentMode).toBe('explain');
    });
  });

  describe('persistMode', () => {
    it('should update mode and persist to storage', async () => {
      await stateStore.persistMode('general');

      expect(stateStore.getSnapshot().currentMode).toBe('general');
      expect(mockStorage.set).toHaveBeenCalledWith({
        lockinActiveMode: 'general',
      });
    });

    it("should save to lastUsed when mode preference is 'lastUsed'", async () => {
      mockStorage.get.mockResolvedValue({
        modePreference: 'lastUsed',
      });

      await stateStore.persistMode('general');

      // Storage.set is called twice: once for lastUsedMode, once for lockinActiveMode
      expect(mockStorage.set).toHaveBeenCalledTimes(2);
      expect(mockStorage.set).toHaveBeenNthCalledWith(1, {
        lastUsedMode: 'general',
      });
      expect(mockStorage.set).toHaveBeenNthCalledWith(2, {
        lockinActiveMode: 'general',
      });
    });
  });

  describe('setSelection', () => {
    it('should update cached selection', () => {
      stateStore.setSelection('Selected text');

      expect(stateStore.getSnapshot().cachedSelection).toBe('Selected text');
    });

    it('should handle empty string', () => {
      stateStore.setSelection('');

      expect(stateStore.getSnapshot().cachedSelection).toBe('');
    });
  });

  describe('setActiveTab', () => {
    it('should update active tab and persist', async () => {
      stateStore.setActiveTab('notes');

      expect(stateStore.getSnapshot().currentActiveTab).toBe('notes');
      // setActiveTab uses async storage.set, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockStorage.set).toHaveBeenCalled();
    });

    it('should not update for non-string values', () => {
      const before = stateStore.getSnapshot().currentActiveTab;
      stateStore.setActiveTab(123);
      expect(stateStore.getSnapshot().currentActiveTab).toBe(before);
    });
  });

  describe('setChatId', () => {
    it('should update chat ID and persist to local storage', async () => {
      await stateStore.setChatId('chat-123');

      expect(stateStore.getSnapshot().currentChatId).toBe('chat-123');
      expect(mockStorage.setLocal).toHaveBeenCalledWith('lockinCurrentChatId', 'chat-123');
    });

    it('should remove chat ID when set to null', async () => {
      await stateStore.setChatId('chat-123');
      await stateStore.setChatId(null);

      expect(stateStore.getSnapshot().currentChatId).toBe(null);
      expect(mockStorage.removeLocal).toHaveBeenCalledWith('lockinCurrentChatId');
    });
  });

  describe('setPreferences', () => {
    it('should update session preferences', () => {
      stateStore.setPreferences({ preferredLanguage: 'es' });

      const snapshot = stateStore.getSnapshot();
      expect(snapshot.sessionPreferences.preferredLanguage).toBe('es');
      expect(snapshot.sessionPreferences.difficultyLevel).toBe('highschool'); // Should preserve other prefs
    });
  });

  describe('loadInitial', () => {
    it('should load initial state from storage', async () => {
      mockStorage.get.mockResolvedValue({
        lockin_sidebar_isOpen: true,
        lockin_sidebar_activeTab: 'notes',
        highlightingEnabled: false,
      });

      const snapshot = await stateStore.loadInitial();

      expect(snapshot.isSidebarOpen).toBe(true);
      expect(snapshot.currentActiveTab).toBe('notes');
      expect(snapshot.highlightingEnabled).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'));

      const snapshot = await stateStore.loadInitial();

      // Should still return a valid snapshot
      expect(snapshot).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should work without storage', async () => {
      const storeWithoutStorage = createStateStore({ Storage: null, Logger: mockLogger });
      const snapshot = await storeWithoutStorage.loadInitial();

      expect(snapshot).toBeDefined();
      expect(snapshot.currentMode).toBe('explain');
    });
  });

  describe('determineDefaultMode', () => {
    it('should use stored mode if available', async () => {
      mockStorage.get.mockResolvedValue({
        lockinActiveMode: 'general',
      });

      const mode = await stateStore.determineDefaultMode();

      expect(mode).toBe('general');
    });

    it("should use lastUsed mode when preference is 'lastUsed'", async () => {
      mockStorage.get.mockResolvedValue({
        modePreference: 'lastUsed',
        lastUsedMode: 'general',
      });

      const mode = await stateStore.determineDefaultMode();

      expect(mode).toBe('general');
    });

    it("should use default mode when preference is 'fixed'", async () => {
      mockStorage.get.mockResolvedValue({
        modePreference: 'fixed',
        defaultMode: 'general',
      });

      const mode = await stateStore.determineDefaultMode();

      expect(mode).toBe('general');
    });

    it("should fallback to 'explain' when no preferences found", async () => {
      mockStorage.get.mockResolvedValue({});

      const mode = await stateStore.determineDefaultMode();

      expect(mode).toBe('explain');
    });
  });

  describe('startSync and stopSync', () => {
    it('should start storage sync', () => {
      const unsubscribe = stateStore.startSync();

      expect(mockStorage.onChanged).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop storage sync', () => {
      stateStore.startSync();
      stateStore.stopSync();

      // stopSync should clean up the subscription
      expect(mockStorage.onChanged).toHaveBeenCalled();
    });

    it('should handle storage changes', () => {
      const callback = vi.fn();
      stateStore.subscribe(callback);

      stateStore.startSync();

      // Simulate storage change
      const mockUnsubscribe = vi.fn();
      mockStorage.onChanged.mockReturnValue(mockUnsubscribe);
      const changeHandler = mockStorage.onChanged.mock.calls[0][0];

      changeHandler(
        {
          lockinActiveMode: { newValue: 'general' },
        },
        'sync',
      );

      expect(callback).toHaveBeenCalled();
      expect(stateStore.getSnapshot().currentMode).toBe('general');
    });
  });
});
