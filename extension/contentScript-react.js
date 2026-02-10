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

let bootstrapPromise = null;
let hasBootstrapped = false;

async function waitForUIBundle(attempt = 0) {
  if (window.LockInUI && window.LockInUI.createLockInSidebar) return true;
  if (attempt > 50) {
    Logger.error('LockInUI not available after waiting');
    return false;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return waitForUIBundle(attempt + 1);
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
    bootstrapPromise = null;
    return;
  }

  bootstrapPromise = (async () => {
    if (!(await waitForUIBundle())) return;

    const apiClient = window.LockInAPI;
    if (!apiClient) {
      Logger.error('API client not available');
      return;
    }

    // Validate API client has required methods
    if (typeof apiClient.toggleNoteStar !== 'function') {
      Logger.error(
        'API client is missing toggleNoteStar method. Available methods:',
        Object.keys(apiClient),
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

    // Restore persisted sidebar width before first render to prevent flash
    const runtimeStorage = Runtime.storage || null;
    if (runtimeStorage && typeof runtimeStorage.getLocal === 'function') {
      try {
        const data = await runtimeStorage.getLocal('lockin_sidebar_width');
        const width = data && data['lockin_sidebar_width'];
        if (typeof width === 'number' && width > 0) {
          document.documentElement.style.setProperty('--lockin-sidebar-width', width + 'px');
        }
      } catch (_) {
        // useResize hook will retry from the React side
      }
    }

    sidebarHost.renderSidebar({
      apiClient,
      adapter,
      pageContext,
      state: initialState,
      onToggle: handleSidebarToggle,
      onClearPrefill: stateStore.clearPendingPrefill,
    });

    await sessionManager.getTabId();
    await sessionManager.restoreSession();

    const closeSidebar = async () => {
      const snapshot = stateStore.getSnapshot();
      if (snapshot.isSidebarOpen) {
        await stateStore.setSidebarOpen(false);
      }
    };

    const interactionController = createInteractionController({
      stateStore,
      onCloseSidebar: closeSidebar,
      logger: Logger,
    });

    interactionController.bind();

    // Initialize fake fullscreen (optional — gracefully skipped if not loaded)
    if (typeof createFakeFullscreen === 'function') {
      const fakeFullscreen = createFakeFullscreen({
        Logger,
        stateStore,
      });
      fakeFullscreen.init();
      window.LockInContent.fakeFullscreen = fakeFullscreen;
      Logger.debug('Fake fullscreen initialized');
    }

    if (Messaging && typeof Messaging.onMessage === 'function') {
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
        }
        return undefined;
      });
    }

    // Set up message handler for media fetch requests (for AI transcription)
    setupMediaFetchHandler();

    hasBootstrapped = true;
  })();

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
