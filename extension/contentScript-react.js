/**
 * Lock-in Content Script (React) - Thin orchestrator
 *
 * Responsibilities:
 * - Ensure UI bundle and helpers are loaded
 * - Resolve site adapter and page context
 * - Wire the state store, session manager, and sidebar host
 * - Bind user interactions (selection + Escape close)
 */

const Runtime = window.LockInContent || {};
const Logger =
  Runtime.logger ||
  window.LockInLogger || {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  };
const Storage = Runtime.storage || window.LockInStorage || null;
const Messaging = Runtime.messaging || window.LockInMessaging || null;
const ContentHelpers = Runtime || {};

const MIN_SELECTION_LENGTH = 3;
let bootstrapPromise = null;
let hasBootstrapped = false;

async function waitForUIBundle(attempt = 0) {
  if (window.LockInUI && window.LockInUI.createLockInSidebar) return true;
  if (attempt > 50) {
    Logger.error("LockInUI not available after waiting");
    return false;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return waitForUIBundle(attempt + 1);
}

async function bootstrap() {
  if (hasBootstrapped) {
    Logger.debug("Skipping bootstrap: already initialized");
    return;
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  Logger.debug("Starting content script bootstrap");

  const {
    resolveAdapterContext,
    createStateStore,
    createSidebarHost,
    createSessionManager,
    createInteractionController,
  } = ContentHelpers;

  if (
    !resolveAdapterContext ||
    !createStateStore ||
    !createSidebarHost ||
    !createSessionManager ||
    !createInteractionController
  ) {
    Logger.error("Content helpers missing on window.LockInContent");
    bootstrapPromise = null;
    return;
  }

  bootstrapPromise = (async () => {
    if (!(await waitForUIBundle())) return;

    const apiClient = window.LockInAPI;
    if (!apiClient) {
      Logger.error("API client not available");
      return;
    }

    // Validate API client has required methods
    if (typeof apiClient.toggleNoteStar !== "function") {
      Logger.error(
        "API client is missing toggleNoteStar method. Available methods:",
        Object.keys(apiClient)
      );
      // Continue anyway - the error will be caught by the notes service
    }

    const { adapter, pageContext } = resolveAdapterContext(Logger);
    const stateStore = createStateStore({ Storage, Logger });
    const sidebarHost = createSidebarHost({ Logger, Storage });
    const sessionManager = createSessionManager({
      Messaging,
      Logger,
      stateStore,
      origin: window.location.origin,
    });

    const updateSidebarFromState = (snapshot) => {
      sidebarHost.updatePropsFromState(snapshot);
    };

    stateStore.subscribe(updateSidebarFromState);
    stateStore.startSync();

    const handleSidebarToggle = async () => {
      const snapshot = stateStore.getSnapshot();
      await stateStore.setSidebarOpen(!snapshot.isSidebarOpen);
    };

    const initialState = await stateStore.loadInitial();
    sidebarHost.renderSidebar({
      apiClient,
      adapter,
      pageContext,
      state: initialState,
      onToggle: handleSidebarToggle,
    });

    await sessionManager.getTabId();
    await sessionManager.restoreSession();

    const runMode = async (mode) => {
      await stateStore.persistMode(mode);
      const snapshot = stateStore.getSnapshot();
      if (!snapshot.isSidebarOpen) {
        await stateStore.setSidebarOpen(true);
      } else {
        sidebarHost.updatePropsFromState(snapshot);
      }
    };

    const closeSidebar = async () => {
      const snapshot = stateStore.getSnapshot();
      if (snapshot.isSidebarOpen) {
        await stateStore.setSidebarOpen(false);
      }
    };

    const interactionController = createInteractionController({
      stateStore,
      onRunMode: runMode,
      onCloseSidebar: closeSidebar,
      determineMode: () => stateStore.determineDefaultMode(),
      logger: Logger,
      minSelectionLength: MIN_SELECTION_LENGTH,
    });

    interactionController.bind();
    hasBootstrapped = true;
  })();

  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

function safeInit() {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
    bootstrap();
  } else {
    Logger.warn("Chrome extension API not available");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInit);
} else {
  safeInit();
}
