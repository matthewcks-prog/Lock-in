/**
 * Lock-in Content Script (React) - Thin orchestrator
 *
 * Responsibilities:
 * - Ensure UI bundle and helpers are loaded
 * - Resolve site adapter and page context
 * - Wire the state store, session manager, and sidebar host
 * - Bind user interactions (Escape close)
 */

// ============================================================================
// Sentry Initialization (must be first)
// ============================================================================

// Initialize Sentry for error tracking (content script surface)
// LockInSentry is loaded via dist/libs/sentry.js before this script (see manifest.json)
if (typeof window !== 'undefined' && window.LockInSentry) {
  window.LockInSentry.initSentry('content');
}

const Runtime = window.LockInContent || {};
const Logger = Runtime.logger ||
  window.LockInLogger || {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  };
const Storage = Runtime.storage || window.LockInStorage || null;
const Messaging = Runtime.messaging || window.LockInMessaging || null;
const ContentHelpers = Runtime || {};
const DEFAULT_SIDEBAR_WIDTH_STORAGE_KEY = 'lockin_sidebar_width';

let bootstrapPromise = null;
let hasBootstrapped = false;
const UI_BUNDLE_WAIT_MAX_ATTEMPTS = 50;

async function waitForUIBundle(attempt = 0) {
  if (window.LockInUI && window.LockInUI.createLockInSidebar) return true;
  if (attempt > UI_BUNDLE_WAIT_MAX_ATTEMPTS) {
    Logger.error('LockInUI not available after waiting');
    return false;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return waitForUIBundle(attempt + 1);
}

function resolveBootstrapHelpers() {
  const {
    resolveAdapterContext,
    createStateStore,
    createSidebarHost,
    createSessionManager,
    createInteractionController,
    createFakeFullscreen,
  } = ContentHelpers;
  if (
    !resolveAdapterContext ||
    !createStateStore ||
    !createSidebarHost ||
    !createSessionManager ||
    !createInteractionController
  ) {
    Logger.error('Content helpers missing on window.LockInContent');
    return null;
  }
  return {
    resolveAdapterContext,
    createStateStore,
    createSidebarHost,
    createSessionManager,
    createInteractionController,
    createFakeFullscreen,
  };
}

function resolveApiClient() {
  const apiClient = window.LockInAPI;
  if (!apiClient) {
    Logger.error('API client not available');
    return null;
  }
  if (typeof apiClient.toggleNoteStar !== 'function') {
    Logger.error(
      'API client is missing toggleNoteStar method. Available methods:',
      Object.keys(apiClient),
    );
  }
  return apiClient;
}

function bindStateSync(stateStore, sidebarHost) {
  stateStore.subscribe((snapshot) => {
    sidebarHost.updatePropsFromState(snapshot);
  });
  stateStore.startSync();
}

function normalizeStorageKeys(rawKeys) {
  return Array.isArray(rawKeys) ? rawKeys.filter((key) => typeof key === 'string' && key) : [];
}

function collectLocalStorageKeys(rawKeys) {
  const keys = normalizeStorageKeys(rawKeys);
  const values = {};
  keys.forEach((key) => {
    try {
      values[key] = localStorage.getItem(key);
    } catch {
      values[key] = null;
    }
  });
  return values;
}

function clearLocalStorageKeys(rawKeys) {
  const keys = normalizeStorageKeys(rawKeys);
  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures in restricted contexts.
    }
  });
  return keys.length;
}

function registerPrefillMessaging(stateStore) {
  if (!Messaging || typeof Messaging.onMessage !== 'function') return;
  Messaging.onMessage((message) => {
    if (message?.type === 'PREFILL_CHAT_INPUT') {
      const text = typeof message.payload?.text === 'string' ? message.payload.text : '';
      if (!text.trim()) return undefined;
      stateStore.setPendingPrefill(text);
      stateStore.setActiveTab('chat');
      if (!stateStore.getSnapshot().isSidebarOpen) {
        stateStore.setSidebarOpen(true).catch((error) => {
          Logger.warn('Failed to open sidebar for prefill:', error);
        });
      }
      return undefined;
    }
    if (message?.type === 'LOCKIN_COLLECT_LOCAL_STORAGE_KEYS') {
      return {
        ok: true,
        data: collectLocalStorageKeys(message.payload?.keys),
      };
    }
    if (message?.type === 'LOCKIN_CLEAR_LOCAL_STORAGE_KEYS') {
      return {
        ok: true,
        clearedCount: clearLocalStorageKeys(message.payload?.keys),
      };
    }
    return undefined;
  });
}

function bindInteractions(createInteractionController, stateStore) {
  const closeSidebar = async () => {
    const snapshot = stateStore.getSnapshot();
    if (snapshot.isSidebarOpen) {
      await stateStore.setSidebarOpen(false);
    }
  };
  createInteractionController({
    stateStore,
    onCloseSidebar: closeSidebar,
    logger: Logger,
  }).bind();
}

async function restorePersistedSidebarWidth() {
  const runtimeStorage = Runtime.storage;
  if (!runtimeStorage || typeof runtimeStorage.getLocal !== 'function') {
    return;
  }
  const sidebarWidthKey =
    runtimeStorage.STORAGE_KEYS?.SIDEBAR_WIDTH || DEFAULT_SIDEBAR_WIDTH_STORAGE_KEY;
  try {
    const data = await runtimeStorage.getLocal(sidebarWidthKey);
    const width = data?.[sidebarWidthKey];
    if (typeof width === 'number' && width > 0) {
      document.documentElement.style.setProperty('--lockin-sidebar-width', `${width}px`);
    }
  } catch (error) {
    Logger.warn('Failed to restore sidebar width from storage:', error);
  }
}

async function renderSidebar({ apiClient, pageContext, stateStore, sidebarHost }) {
  const handleSidebarToggle = async () => {
    const snapshot = stateStore.getSnapshot();
    await stateStore.setSidebarOpen(!snapshot.isSidebarOpen);
  };
  const initialState = await stateStore.loadInitial();
  sidebarHost.renderSidebar({
    apiClient,
    pageContext,
    state: initialState,
    onToggle: handleSidebarToggle,
    onClearPrefill: stateStore.clearPendingPrefill,
  });
}

function initFakeFullscreen(createFakeFullscreen, stateStore) {
  if (typeof createFakeFullscreen !== 'function') {
    return;
  }
  try {
    const fakeFullscreen = createFakeFullscreen({
      Logger,
      stateStore,
      scrollbarManager:
        window.LockInContent && window.LockInContent.scrollbarManager
          ? window.LockInContent.scrollbarManager
          : null,
    });
    if (fakeFullscreen && typeof fakeFullscreen.init === 'function') {
      fakeFullscreen.init();
      Logger.debug('[Lock-in] Fake fullscreen initialized');
    }
  } catch (error) {
    Logger.error('[Lock-in] Failed to initialize fake fullscreen:', error);
  }
}

async function runBootstrapTask(helpers) {
  if (!(await waitForUIBundle())) return;
  const apiClient = resolveApiClient();
  if (!apiClient) return;

  const { pageContext } = helpers.resolveAdapterContext(Logger);
  const stateStore = helpers.createStateStore({ Storage, Logger });
  const sidebarHost = helpers.createSidebarHost({ Logger, Storage });
  const sessionManager = helpers.createSessionManager({
    Messaging,
    Logger,
    stateStore,
    origin: window.location.origin,
  });
  bindStateSync(stateStore, sidebarHost);
  await restorePersistedSidebarWidth();
  await renderSidebar({ apiClient, pageContext, stateStore, sidebarHost });
  await sessionManager.getTabId();
  await sessionManager.restoreSession();
  bindInteractions(helpers.createInteractionController, stateStore);
  initFakeFullscreen(helpers.createFakeFullscreen, stateStore);
  registerPrefillMessaging(stateStore);
  setupMediaFetchHandler();
  hasBootstrapped = true;
}

async function bootstrap() {
  if (hasBootstrapped) {
    Logger.debug('Skipping bootstrap: already initialized');
    return;
  }
  if (bootstrapPromise) {
    return bootstrapPromise;
  }
  Logger.debug('Starting content script bootstrap');
  const helpers = resolveBootstrapHelpers();
  if (!helpers) return;
  bootstrapPromise = runBootstrapTask(helpers);
  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

/**
 * Set up handler for FETCH_MEDIA_FOR_TRANSCRIPTION requests from background script.
 * This enables the content script to fetch authenticated media that may be blocked
 * by CORS when fetched from the background script.
 */
function setupMediaFetchHandler() {
  if (!Messaging || typeof Messaging.onMessage !== 'function') {
    Logger.warn('[Lock-in] Messaging not available for media fetch handler');
    return;
  }

  const MediaFetcher = window.LockInMediaFetcher;
  if (!MediaFetcher) {
    Logger.warn('[Lock-in] MediaFetcher not available');
    return;
  }

  Messaging.onMessage(async (message, sender) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'FETCH_MEDIA_FOR_TRANSCRIPTION') {
      Logger.debug('[Lock-in] Received FETCH_MEDIA_FOR_TRANSCRIPTION request');
      const { mediaUrl, jobId, requestId } = message.payload || {};

      if (!mediaUrl || !jobId || !requestId) {
        return { success: false, error: 'Missing required parameters' };
      }

      try {
        const result = await MediaFetcher.handleMediaFetchRequest(
          { mediaUrl, jobId, requestId },
          async (chunkMessage) => {
            // Send each chunk to the background script
            await Messaging.sendToBackground(chunkMessage);
          },
        );
        return result;
      } catch (error) {
        Logger.error('[Lock-in] Media fetch error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Return undefined for unhandled messages
    return undefined;
  });

  Logger.debug('[Lock-in] Media fetch handler registered');
}

function safeInit() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    bootstrap();
  } else {
    Logger.warn('Chrome extension API not available');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  safeInit();
}
