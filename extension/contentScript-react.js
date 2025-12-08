/**
 * Lock-in Content Script - React-based
 *
 * Main orchestrator for the Lock-in Chrome extension. This script:
 * 1. Loads and initializes the React sidebar widget
 * 2. Manages global state (selection, mode, sidebar visibility)
 * 3. Handles user interactions (text selection, keyboard shortcuts)
 * 4. Syncs state between content script and UI components
 * 5. Manages persistence via Chrome storage
 *
 * ARCHITECTURE:
 * - Uses SINGLETON pattern for React widget (only ONE instance on page)
 * - Widget updates via updateProps() instead of unmount/remount
 * - State changes propagate to widget through prop updates
 * - CSS injected programmatically to ensure styling loads
 *
 * CODE ORGANIZATION:
 * 1. Configuration & Constants (MODES, KEYS, etc.)
 * 2. Global State Management (let declarations)
 * 3. Shared Modules (Storage, Messaging, Logger)
 * 4. Sidebar Instance Management (sidebarInstance)
 * 5. Initialization (init, injectStyles, initializeReactSidebar)
 * 6. Sidebar Control (handleSidebarToggle, runMode)
 * 7. State Persistence (loadToggleState, loadMode, loadStoredChatId)
 * 8. User Interaction (setupEventListeners, handleMouseUp, etc.)
 * 9. Mode Management (determineDefaultMode, runMode)
 * 10. Storage Sync (listenToStorageChanges)
 * 11. Session Management (getTabId, loadSessionForCurrentTab, etc.)
 * 12. Safe Startup (safeInit)
 *
 * IMPORTANT: Always maintain this structure for scalability
 */

// ===================================
// 1. Configuration & Constants
// ===================================
const MIN_SELECTION_LENGTH = 3;
const CHAT_ID_STORAGE_KEY = "lockinCurrentChatId";
const SIDEBAR_OPEN_KEY = "lockin_sidebar_isOpen";
const SIDEBAR_ACTIVE_TAB_KEY = "lockin_sidebar_activeTab";
const MODES = {
  EXPLAIN: "explain",
  SIMPLIFY: "simplify",
  TRANSLATE: "translate",
  GENERAL: "general",
};

// ===================================
// 2. Global State Management
// ===================================
let highlightingEnabled = true;
let currentMode = MODES.EXPLAIN;
let isSidebarOpen = false;
let cachedSelection = "";
let currentChatId = null;
let currentTabId = null;
let currentOrigin = window.location.origin;
let currentActiveTab = "chat";
let sessionPreferences = {
  preferredLanguage: "en",
  difficultyLevel: "highschool",
};
const isMac = navigator.platform.toUpperCase().includes("MAC");

// ===================================
// 3. Shared Modules
// ===================================
const Storage = window.LockInStorage || null;
const Messaging = window.LockInMessaging || null;
const Logger = window.LockInLogger || {
  debug: () => {},
  info: () => {},
  warn: console.warn,
  error: console.error,
};

// ===================================
// 4. Sidebar Instance Management
// ===================================
// Holds { root, unmount, updateProps }
let sidebarInstance = null;
let apiClient = null;
let adapter = null;
let pageContext = null;

// ===================================
// 5. Initialization
// ===================================
async function init() {
  Logger.debug("Initializing React-based content script");

  // Wait for UI bundle to load
  if (!window.LockInUI) {
    Logger.warn("LockInUI not available, waiting...");
    setTimeout(init, 100);
    return;
  }

  // Initialize API client (use existing window.LockInAPI for now)
  // TODO: Use initApi.ts once compiled to JS
  apiClient = window.LockInAPI;
  if (!apiClient) {
    Logger.error("API client not available");
    return;
  }

  // Get adapter and page context
  // Try to use adapter from integrations if available (compiled to JS)
  // Otherwise use simple fallback
  try {
    // Check if adapter system is available (would be from compiled integrations)
    if (typeof window.getCurrentAdapter === "function") {
      adapter = window.getCurrentAdapter();
      pageContext = adapter.getPageContext(document, window.location.href);
    } else {
      // Fallback: simple generic adapter
      adapter = {
        getPageContext: (dom, url) => {
          const heading =
            dom.querySelector("h1, h2")?.textContent?.trim() || dom.title;
          // Try to detect course code from URL or page content
          let courseCode = null;
          const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
          if (urlMatch) {
            courseCode = urlMatch[1].toUpperCase();
          } else {
            const bodyText = dom.body?.innerText || "";
            const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
            if (codeMatch) {
              courseCode = codeMatch[1].toUpperCase();
            }
          }
          return {
            url,
            title: dom.title,
            heading,
            courseContext: {
              courseCode,
              sourceUrl: url,
            },
          };
        },
      };
      pageContext = adapter.getPageContext(document, window.location.href);
    }
  } catch (error) {
    Logger.error("Failed to get page context:", error);
    pageContext = {
      url: window.location.href,
      title: document.title,
      courseContext: { courseCode: null, sourceUrl: window.location.href },
    };
  }

  // Load persisted state
  await loadToggleState();
  await loadMode();
  await loadStoredChatId();

  // Setup event listeners
  listenToStorageChanges();
  setupEventListeners();

  // Initialize React sidebar
  initializeReactSidebar();

  // Get tab ID and restore session
  getTabId().then(() => {
    setTimeout(loadSessionForCurrentTab, 500);
  });
}

/**
 * Inject CSS into the page as a style tag (if needed)
 * NOTE: Full CSS is now loaded via manifest.json content_scripts.css
 * This function is kept as a safety fallback
 */
function injectStyles() {
  // CSS is now included in manifest.json, so this is mostly a no-op
  // Just verify the styles are loaded
  Logger.debug("Styles verification: CSS should be loaded from manifest");
}

/**
 * Initialize React sidebar - Single instance pattern
 * Reuses existing instance when possible, updates props instead of recreating
 */
function initializeReactSidebar() {
  if (!window.LockInUI || !window.LockInUI.createLockInSidebar) {
    Logger.error("LockInUI.createLockInSidebar not available");
    return;
  }

  Logger.debug("Initializing React sidebar (singleton pattern)");

  // Inject CSS first
  injectStyles();

  // Storage adapter for sidebar state
  const storageAdapter = {
    get: async (key) => {
      if (!Storage) return null;
      try {
        const data = await Storage.get(key);
        return data[key];
      } catch (error) {
        Logger.warn("Storage get error:", error);
        return null;
      }
    },
    set: async (key, value) => {
      if (!Storage) return;
      try {
        await Storage.set({ [key]: value });
      } catch (error) {
        Logger.warn("Storage set error:", error);
      }
    },
  };

  // Props for the sidebar
  const sidebarProps = {
    apiClient,
    isOpen: isSidebarOpen,
    onToggle: handleSidebarToggle,
    currentMode,
    selectedText: cachedSelection,
    pageContext,
    adapter,
    storage: storageAdapter,
    activeTabExternal: currentActiveTab,
  };

  // First time: create instance
  if (!sidebarInstance) {
    Logger.debug("Creating new sidebar instance (first time)");
    sidebarInstance = window.LockInUI.createLockInSidebar(sidebarProps);
  } else {
    // Subsequent calls: update props (React will re-render)
    Logger.debug("Updating sidebar props (reusing instance)");
    sidebarInstance.updateProps(sidebarProps);
  }
}

/**
 * Handle sidebar toggle - Updates props instead of recreating
 */
function handleSidebarToggle() {
  isSidebarOpen = !isSidebarOpen;
  Logger.debug("Sidebar toggle:", isSidebarOpen);

  // Update sidebar with new isOpen state
  if (sidebarInstance && sidebarInstance.updateProps) {
    sidebarInstance.updateProps({ isOpen: isSidebarOpen });
  }

  // Save state
  if (Storage) {
    Storage.set({ [SIDEBAR_OPEN_KEY]: isSidebarOpen }).catch((err) =>
      Logger.warn("Failed to save sidebar state:", err)
    );
  }
}

// ===================================
// 7. State Persistence
// ===================================
async function loadToggleState() {
  if (!Storage) return;
  try {
    const data = await Storage.get([
      "highlightingEnabled",
      SIDEBAR_OPEN_KEY,
      SIDEBAR_ACTIVE_TAB_KEY,
    ]);
    highlightingEnabled = data.highlightingEnabled !== false;
    if (typeof data[SIDEBAR_OPEN_KEY] === "boolean") {
      isSidebarOpen = data[SIDEBAR_OPEN_KEY];
    }
    if (typeof data[SIDEBAR_ACTIVE_TAB_KEY] === "string") {
      currentActiveTab = data[SIDEBAR_ACTIVE_TAB_KEY];
    }
  } catch (error) {
    Logger.warn("Failed to load toggle state:", error);
  }
}

async function loadMode() {
  if (!Storage) return;
  try {
    const data = await Storage.get("lockinActiveMode");
    if (data.lockinActiveMode) {
      currentMode = data.lockinActiveMode;
    }
  } catch (error) {
    Logger.warn("Failed to load mode:", error);
  }
}

async function loadStoredChatId() {
  if (!Storage) {
    currentChatId = null;
    return null;
  }
  try {
    const data = await Storage.getLocal(CHAT_ID_STORAGE_KEY);
    currentChatId = data[CHAT_ID_STORAGE_KEY] || null;
    return currentChatId;
  } catch (error) {
    Logger.warn("Failed to load chat ID:", error);
    currentChatId = null;
    return null;
  }
}

// ===================================
// 8. User Interaction Handlers
// ===================================
function setupEventListeners() {
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyPress);
}

function handleMouseUp(event) {
  if (!highlightingEnabled) return;

  const hasModifierKey = isMac ? event.metaKey : event.ctrlKey;
  if (!hasModifierKey) return;

  setTimeout(() => {
    const validationResult = validateSelection();
    if (!validationResult.valid) return;

    cachedSelection = validationResult.text;
    determineDefaultMode().then(() => {
      runMode(currentMode);
    });
  }, 50);
}

function handleKeyPress(event) {
  if (event.key === "Escape" && isSidebarOpen) {
    handleSidebarToggle();
  }
}

function validateSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { valid: false };
  }

  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < MIN_SELECTION_LENGTH) {
    return { valid: false };
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element =
    container.nodeType === 1 ? container : container.parentElement;

  if (
    element &&
    (element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    text: selectedText,
    rect: range.getBoundingClientRect(),
  };
}

// ===================================
// Mode Management
// ===================================
async function determineDefaultMode() {
  if (!Storage) {
    currentMode = MODES.EXPLAIN;
    return;
  }

  try {
    const data = await Storage.get([
      "modePreference",
      "defaultMode",
      "lastUsedMode",
      "lockinActiveMode",
    ]);

    if (data.lockinActiveMode) {
      currentMode = data.lockinActiveMode;
      return;
    }

    const modePref = data.modePreference || "fixed";
    if (modePref === "lastUsed" && data.lastUsedMode) {
      currentMode = data.lastUsedMode;
    } else {
      currentMode = data.defaultMode || MODES.EXPLAIN;
    }
  } catch (error) {
    Logger.warn("Mode determination error:", error);
    currentMode = MODES.EXPLAIN;
  }
}

async function runMode(mode) {
  currentMode = mode;

  // Update lastUsedMode if preference is 'lastUsed'
  if (Storage) {
    try {
      const data = await Storage.get("modePreference");
      if (data.modePreference === "lastUsed") {
        await Storage.set("lastUsedMode", mode);
      }
      await Storage.set("lockinActiveMode", mode);
    } catch (error) {
      Logger.warn("Storage access error:", error);
    }
  }

  // Open sidebar if closed, or update existing instance
  if (!isSidebarOpen) {
    isSidebarOpen = true;
    initializeReactSidebar();
  } else {
    // Update sidebar with new selection and mode (props update, no unmount)
    if (sidebarInstance && sidebarInstance.updateProps) {
      sidebarInstance.updateProps({
        currentMode: mode,
        selectedText: cachedSelection,
      });
    }
  }

  // The React components (ChatPanel) will handle the API call via useChat hook
  // when selectedText prop changes (see ChatPanel.tsx useEffect)
}

async function getSettings() {
  if (!Storage) {
    return { preferredLanguage: "en", difficultyLevel: "highschool" };
  }

  try {
    const data = await Storage.get(["preferredLanguage", "difficultyLevel"]);
    return {
      preferredLanguage: data.preferredLanguage || "en",
      difficultyLevel: data.difficultyLevel || "highschool",
    };
  } catch (error) {
    Logger.warn("Settings access error:", error);
    return { preferredLanguage: "en", difficultyLevel: "highschool" };
  }
}

// ===================================
// 10. Storage Synchronization
// ===================================
function listenToStorageChanges() {
  if (!Storage) return;

  Storage.onChanged((changes, areaName) => {
    if (areaName === "sync" && changes.highlightingEnabled) {
      highlightingEnabled = changes.highlightingEnabled.newValue;
    }

    if (areaName === "sync" && changes.lockinActiveMode) {
      currentMode = changes.lockinActiveMode.newValue;
      // Update sidebar props without unmounting
      if (sidebarInstance && sidebarInstance.updateProps) {
        sidebarInstance.updateProps({ currentMode: currentMode });
      }
    }

    if (areaName === "sync" && changes[SIDEBAR_OPEN_KEY]) {
      isSidebarOpen = changes[SIDEBAR_OPEN_KEY].newValue === true;
      if (sidebarInstance && sidebarInstance.updateProps) {
        sidebarInstance.updateProps({ isOpen: isSidebarOpen });
      }
    }

    if (areaName === "sync" && changes[SIDEBAR_ACTIVE_TAB_KEY]) {
      const newTab = changes[SIDEBAR_ACTIVE_TAB_KEY].newValue;
      if (typeof newTab === "string") {
        currentActiveTab = newTab;
        if (sidebarInstance && sidebarInstance.updateProps) {
          sidebarInstance.updateProps({ activeTabExternal: currentActiveTab });
        }
      }
    }

    if (areaName === "local" && changes[CHAT_ID_STORAGE_KEY]) {
      currentChatId = changes[CHAT_ID_STORAGE_KEY].newValue || null;
    }
  });
}

// ===================================
// 11. Session Management
// ===================================
async function getTabId() {
  if (!Messaging || !chrome.runtime) return;

  try {
    const message = Messaging.createMessage(Messaging.MESSAGE_TYPES.GET_TAB_ID);
    const response = await Messaging.sendMessage(message);
    if (response.ok && response.data) {
      currentTabId = response.data.tabId;
      Logger.debug("Tab ID:", currentTabId);
    }
  } catch (error) {
    Logger.error("Failed to get tab ID:", error);
  }
}

async function loadSessionForCurrentTab() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.GET_SESSION
    );
    const response = await Messaging.sendMessage(message);
    if (!response.ok) return;

    const session = response.data?.session;
    if (!session || !session.isActive) return;

    if (session.origin !== currentOrigin) {
      Logger.debug("Origin changed, not restoring session");
      await clearSessionForCurrentTab();
      return;
    }

    if (session.isClosed) {
      Logger.debug("Session was closed by user");
      return;
    }

    Logger.debug("Restoring session for tab", currentTabId);

    cachedSelection = session.selection || "";
    currentMode = session.mode || "explain";
    sessionPreferences = {
      preferredLanguage: session.targetLanguage || "en",
      difficultyLevel: session.difficultyLevel || "highschool",
    };

    if (session.chatId) {
      currentChatId = session.chatId;
      await setStoredChatId(session.chatId);
    }

    if (cachedSelection) {
      isSidebarOpen = true;
      initializeReactSidebar();
    }
  } catch (error) {
    Logger.error("Failed to load session:", error);
  }
}

async function setStoredChatId(chatId) {
  if (!Storage) {
    currentChatId = chatId || null;
    return;
  }

  try {
    if (!chatId) {
      await Storage.removeLocal(CHAT_ID_STORAGE_KEY);
    } else {
      await Storage.setLocal(CHAT_ID_STORAGE_KEY, chatId);
    }
    currentChatId = chatId || null;
  } catch (error) {
    Logger.warn("Failed to save chat ID:", error);
  }
}

async function clearSessionForCurrentTab() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.CLEAR_SESSION
    );
    await Messaging.sendMessage(message);
  } catch (error) {
    Logger.error("Failed to clear session:", error);
  }
}

// ===================================
// 12. Safe Startup
// ===================================
function safeInit() {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
    init();
  } else {
    Logger.warn("Chrome extension API not available");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInit);
} else {
  safeInit();
}
