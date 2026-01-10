import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BootstrapTestWindow = Omit<
  typeof window,
  'LockInContent' | 'LockInUI' | 'LockInAPI' | 'LockInLogger'
> & {
  LockInContent?: unknown;
  LockInUI?: unknown;
  LockInAPI?: unknown;
  LockInLogger?: unknown;
};

const originalReadyState = Object.getOwnPropertyDescriptor(document, 'readyState');

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => value,
  });
}

function resetReadyState() {
  if (originalReadyState) {
    Object.defineProperty(document, 'readyState', originalReadyState);
  } else {
    const mutableDocument = document as unknown as { readyState?: DocumentReadyState };
    delete mutableDocument.readyState;
  }
}

function setupChromeRuntime() {
  const storageSync = {
    get: vi.fn((_keys: string | string[], cb: (value: Record<string, unknown>) => void) => cb({})),
    set: vi.fn((_data: Record<string, unknown>, cb: () => void = () => {}) => cb()),
    remove: vi.fn((_keys: string | string[], cb: () => void = () => {}) => cb()),
  };

  const storageLocal = {
    get: vi.fn((_keys: string | string[], cb: (value: Record<string, unknown>) => void) => cb({})),
    set: vi.fn((_data: Record<string, unknown>, cb: () => void = () => {}) => cb()),
    remove: vi.fn((_keys: string | string[], cb: () => void = () => {}) => cb()),
  };

  vi.stubGlobal('chrome', {
    runtime: { id: 'test-runtime-id', lastError: null, sendMessage: vi.fn() },
    storage: {
      sync: storageSync,
      local: storageLocal,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { sendMessage: vi.fn() },
  });
}

function createContentHelpers() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const state = {
    isSidebarOpen: false,
    currentMode: 'explain',
    cachedSelection: '',
    currentActiveTab: 'chat',
  };

  const subscribers = new Set<(snapshot: typeof state) => void>();

  const stateStore = {
    subscribe: vi.fn((cb: (snapshot: typeof state) => void) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    }),
    startSync: vi.fn(),
    loadInitial: vi.fn(async () => ({ ...state })),
    getSnapshot: vi.fn(() => ({ ...state })),
    setSidebarOpen: vi.fn(async (isOpen: boolean) => {
      state.isSidebarOpen = isOpen;
      subscribers.forEach((cb) => cb({ ...state }));
    }),
    persistMode: vi.fn(async (mode: string) => {
      state.currentMode = mode;
    }),
    determineDefaultMode: vi.fn(() => state.currentMode),
  };

  const sidebarInstance = {
    updateProps: vi.fn(),
  };

  const lockInUIFactory = {
    createLockInSidebar: vi.fn((_props: Record<string, unknown>) => sidebarInstance),
  };

  const sidebarHost = {
    renderSidebar: vi.fn((props: Record<string, unknown>) => {
      lockInUIFactory.createLockInSidebar(props);
    }),
    updatePropsFromState: vi.fn((snapshot: typeof state) => {
      sidebarInstance.updateProps(snapshot);
    }),
  };

  const sessionManager = {
    getTabId: vi.fn(async () => 7),
    restoreSession: vi.fn(async () => {}),
  };

  const interactionController = {
    bind: vi.fn(),
  };

  const lockInContent = {
    logger,
    resolveAdapterContext: vi.fn(() => ({
      adapter: { id: 'adapter' },
      pageContext: {
        courseContext: { courseCode: 'ABC123', sourceUrl: 'https://example.test' },
      },
    })),
    createStateStore: vi.fn(() => stateStore),
    createSidebarHost: vi.fn(() => sidebarHost),
    createSessionManager: vi.fn(() => sessionManager),
    createInteractionController: vi.fn(() => interactionController),
    storage: {},
    messaging: {},
  };

  const apiClient = {
    toggleNoteStar: vi.fn(),
  };

  return {
    logger,
    stateStore,
    sidebarHost,
    sessionManager,
    interactionController,
    lockInContent,
    lockInUIFactory,
    apiClient,
  };
}

async function loadContentScript() {
  // @ts-expect-error - content script bundle is JS without types
  return import('../../contentScript-react.js');
}

describe('contentScript-react bootstrap init order', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetReadyState();
    vi.useRealTimers();
  });

  it('waits for a late LockInUI and still bootstraps without throwing', async () => {
    const testWindow = window as BootstrapTestWindow;
    const { logger, lockInContent, lockInUIFactory, apiClient, stateStore, interactionController } =
      createContentHelpers();

    setupChromeRuntime();
    setReadyState('complete');

    testWindow.LockInContent = lockInContent;
    testWindow.LockInAPI = apiClient;

    setTimeout(() => {
      testWindow.LockInUI = lockInUIFactory;
    }, 50);

    await loadContentScript();
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(logger.error).not.toHaveBeenCalledWith('LockInUI not available after waiting');
    expect(lockInContent.resolveAdapterContext).toHaveBeenCalledTimes(1);
    expect(lockInContent.createSidebarHost).toHaveBeenCalledTimes(1);
    expect(lockInContent.createStateStore).toHaveBeenCalledTimes(1);
    expect(stateStore.startSync).toHaveBeenCalledTimes(1);
    expect(lockInUIFactory.createLockInSidebar).toHaveBeenCalledTimes(1);
    expect(interactionController.bind).toHaveBeenCalledTimes(1);
  });

  it('guards missing content runtime and succeeds once helpers appear', async () => {
    const testWindow = window as BootstrapTestWindow;
    const { logger, lockInContent, lockInUIFactory, apiClient, interactionController } =
      createContentHelpers();

    setupChromeRuntime();
    setReadyState('complete');

    testWindow.LockInLogger = logger;
    delete testWindow.LockInContent;
    delete testWindow.LockInUI;

    await loadContentScript();
    await vi.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith('Content helpers missing on window.LockInContent');

    testWindow.LockInContent = lockInContent;
    testWindow.LockInAPI = apiClient;
    testWindow.LockInUI = lockInUIFactory;

    vi.resetModules();
    await loadContentScript();
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(lockInContent.resolveAdapterContext).toHaveBeenCalledTimes(1);
    expect(lockInUIFactory.createLockInSidebar).toHaveBeenCalledTimes(1);
    expect(interactionController.bind).toHaveBeenCalledTimes(1);
  });

  it('is idempotent if bootstrap is triggered twice', async () => {
    const testWindow = window as BootstrapTestWindow;
    const { lockInContent, lockInUIFactory, apiClient, stateStore, interactionController } =
      createContentHelpers();

    setupChromeRuntime();
    setReadyState('loading');

    testWindow.LockInContent = lockInContent;
    testWindow.LockInAPI = apiClient;
    testWindow.LockInUI = lockInUIFactory;

    const domReadyHandlers: Array<() => void> = [];
    const originalAddEventListener = document.addEventListener;
    vi.spyOn(document, 'addEventListener').mockImplementation(function (
      this: Document,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === 'DOMContentLoaded' && typeof listener === 'function') {
        domReadyHandlers.push(listener as () => void);
      }
      return originalAddEventListener.call(this, type, listener, options);
    });

    await loadContentScript();

    expect(domReadyHandlers.length).toBeGreaterThanOrEqual(1);

    // Trigger bootstrap twice in quick succession
    domReadyHandlers[0]();
    domReadyHandlers[0]();

    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(lockInContent.createStateStore).toHaveBeenCalledTimes(1);
    expect(lockInContent.createSidebarHost).toHaveBeenCalledTimes(1);
    expect(lockInUIFactory.createLockInSidebar).toHaveBeenCalledTimes(1);
    expect(stateStore.subscribe).toHaveBeenCalledTimes(1);
    expect(interactionController.bind).toHaveBeenCalledTimes(1);
  });
});
