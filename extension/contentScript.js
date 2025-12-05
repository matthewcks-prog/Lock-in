/**
 * Lock-in Content Script - Contextual AI Assistant
 * Features:
 * - Modifier key requirement (Ctrl/Cmd + selection)
 * - Smart contextual bubble placement
 * - Draggable response bubble
 * - On/off toggle via popup
 */

/**
 * @typedef {Object} StudyResponse
 * @property {string} mode - The mode used ("explain" | "simplify" | "translate" | "general")
 * @property {string} explanation - The main answer/explanation for the user
 * @property {Array<{title: string, content: string, type: string}>} notes - Array of possible notes to save
 * @property {Array<{title: string, description: string}>} todos - Array of possible tasks
 * @property {string[]} tags - Array of topic tags
 * @property {"easy" | "medium" | "hard"} difficulty - Estimated difficulty of the selected text
 */

/**
 * @typedef {Object} LockInApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {StudyResponse} [data] - Response data if success is true
 * @property {{message: string}} [error] - Error information if success is false
 * @property {string} [chatId] - Chat ID if available
 */

// ===================================
// Configuration
// ===================================
const BACKEND_URL =
  (window.LOCKIN_CONFIG && window.LOCKIN_CONFIG.BACKEND_URL) ||
  "http://localhost:3000";
const MIN_SELECTION_LENGTH = 3; // Minimum characters to trigger
const BUBBLE_OFFSET = 10; // Pixels offset from selection
const CHAT_ID_STORAGE_KEY = "lockinCurrentChatId";
const RECENT_CHAT_LIMIT = 10;

// ===================================
// Modes Configuration (easy to extend)
// ===================================
const MODES = {
  EXPLAIN: "explain",
  SIMPLIFY: "simplify",
  TRANSLATE: "translate",
};

const MODE_CONFIG = {
  [MODES.EXPLAIN]: { icon: "&#128161;", label: "Explain" },
  [MODES.SIMPLIFY]: { icon: "&#9986;", label: "Simplify" },
  [MODES.TRANSLATE]: { icon: "&#127757;", label: "Translate" },
};

// ===================================
// Theme & Personalisation Configuration
// ===================================
const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
};

const ACCENT_COLORS = {
  BLUE: { name: "Blue", hex: "#667eea" },
  PURPLE: { name: "Purple", hex: "#a78bfa" },
  TEAL: { name: "Teal", hex: "#14b8a6" },
  GREEN: { name: "Green", hex: "#10b981" },
  ORANGE: { name: "Orange", hex: "#f59e0b" },
};


// ===================================
// State Management
// ===================================
let highlightingEnabled = true; // Toggle state from popup
let currentMode = MODES.EXPLAIN; // Current active mode
let isBubbleOpen = true; // Bubble visibility state (persisted)
let cachedSelection = ""; // Selected text
let cachedRect = null; // Selection bounding box
let activeBubble = null; // Current bubble element (widget-based)
let activePill = null; // Legacy pill element (unused with LockinWidget, kept for safety)
let isDraggingBubble = false; // Legacy drag flag (no longer used with LockinWidget)
let chatHistory = []; // Conversation history for the current selection
let pendingInputValue = ""; // Value inside the follow-up input
let isChatLoading = false; // Whether we are waiting on the backend
let sessionPreferences = {
  preferredLanguage: "en",
  difficultyLevel: "highschool",
};
let currentTabId = null; // Current tab ID
let currentOrigin = window.location.origin; // Current origin
let currentChatId = null; // Active chat identifier shared across popup/content
let recentChats = [];
let isHistoryPanelOpen = false;
let historyStatusMessage = "";
let isHistoryLoading = false;
let hasLoadedChats = false;
const isMac = navigator.platform.toUpperCase().includes("MAC");

// Theme & personalisation state
let currentTheme = THEMES.LIGHT;
let currentAccentColor = "#667eea";
let userProfile = {
  name: "User",
  email: "user@example.com",
  plan: "Free",
};
let isPersonalisationPanelOpen = false;

// ===================================
// Global Widget & Shared Utilities
// ===================================
let lockinWidget = null;

// Optional shared utilities loaded from chatHistoryUtils.js.
// The content script must continue to work even if this file fails to load.
const LockInChatHistoryUtils = window.LockInChatHistoryUtils || null;

// Shared modules (must be loaded before this script)
const Storage = window.LockInStorage || null;
const API = window.LockInAPI || null;
const Messaging = window.LockInMessaging || null;
const Logger = window.LockInLogger || {
  debug: () => {},
  info: () => {},
  warn: console.warn,
  error: console.error,
};

// STORAGE_KEYS is loaded globally by libs/storage.js
// which is loaded before this script in manifest.json
// Fallback to local definition if not available
if (typeof STORAGE_KEYS === "undefined") {
  window.STORAGE_KEYS = {
    BUBBLE_OPEN: "lockinBubbleOpen",
    ACTIVE_MODE: "lockinActiveMode",
    THEME: "lockinTheme",
    ACCENT_COLOR: "lockinAccentColor",
    BUBBLE_POSITION: "lockinBubblePosition",
    BUBBLE_SIZE: "lockinBubbleSize",
    USER_PROFILE: "lockinUserProfile",
  };
}

// ===================================
// Load persisted UI preferences
// ===================================
async function loadToggleState() {
  if (!Storage) {
    return;
  }

  try {
    const data = await Storage.get("highlightingEnabled");
    highlightingEnabled = data.highlightingEnabled !== false;
  } catch (error) {
    Logger.warn("Failed to load toggle state:", error);
  }
}

async function loadThemeAndPersonalisation() {
  if (!Storage) {
    return;
  }

  try {
    const data = await Storage.get([
      STORAGE_KEYS.THEME,
      STORAGE_KEYS.ACCENT_COLOR,
      STORAGE_KEYS.ACTIVE_MODE,
      STORAGE_KEYS.USER_PROFILE,
    ]);
    currentTheme = data[STORAGE_KEYS.THEME] || THEMES.LIGHT;
    currentAccentColor = data[STORAGE_KEYS.ACCENT_COLOR] || "#667eea";
    currentMode = data[STORAGE_KEYS.ACTIVE_MODE] || MODES.EXPLAIN;
    if (data[STORAGE_KEYS.USER_PROFILE]) {
      userProfile = data[STORAGE_KEYS.USER_PROFILE];
    }
    applyTheme();
  } catch (error) {
    Logger.warn("Failed to load theme and personalisation:", error);
  }
}

// ===================================
// Initialization
// ===================================
async function init() {
  await loadToggleState();
  await loadThemeAndPersonalisation();
  listenToStorageChanges();
  setupEventListeners();
  await loadStoredChatId();
  listenToAuthChanges();

  // Initialize sidebar system (replaces LockinWidget)
  if (typeof LockinSidebar !== "undefined") {
    Logger.debug("LockinSidebar class found, initializing...");
    initializeSidebar();
  } else {
    Logger.warn("LockinSidebar class not found!");
  }

  // Get tab ID and restore session if available
  getTabId().then(() => {
    setTimeout(loadSessionForCurrentTab, 500);
  });
}

/**
 * Initialize the Lock-in sidebar
 */
function initializeSidebar() {
  Logger.debug("initializeSidebar called");
  lockinWidget = new LockinSidebar({
    sidebarWidth: 380,
  });
  Logger.debug("LockinSidebar instance created");
  lockinWidget.init();
  Logger.debug("Sidebar init() called, sidebar.isOpen:", lockinWidget.isOpen);

  // Listen to sidebar events
  window.addEventListener("lockin:open", handleSidebarOpen);
  window.addEventListener("lockin:close", handleSidebarClose);
  window.addEventListener("lockin:selectChat", handleSelectChat);
  window.addEventListener("lockin:newChat", handleNewChatEvent);
  window.addEventListener("lockin:switchMode", handleSwitchModeEvent);
  window.addEventListener("lockin:sendMessage", handleSendMessageEvent);
  window.addEventListener("lockin:deleteChat", handleDeleteChatEvent);
  Logger.debug("Sidebar event listeners attached");
}

/**
 * Handle sidebar open event
 */
async function handleSidebarOpen() {
  isBubbleOpen = true;
  if (Storage) {
    try {
      await Storage.set(STORAGE_KEYS.BUBBLE_OPEN, true);
    } catch (error) {
      Logger.warn("Failed to save sidebar state:", error);
    }
  }
  renderSidebarContent();
}

/**
 * Handle sidebar close event
 */
async function handleSidebarClose() {
  isBubbleOpen = false;
  if (Storage) {
    try {
      await Storage.set(STORAGE_KEYS.BUBBLE_OPEN, false);
    } catch (error) {
      Logger.warn("Failed to save sidebar state:", error);
    }
  }
}

/**
 * Handle select chat event
 */
function handleSelectChat(event) {
  const { chatId } = event.detail;
  handleHistorySelection(chatId);
}

/**
 * Handle new chat event
 */
function handleNewChatEvent() {
  handleNewChatRequest();
}

/**
 * Handle switch mode event
 */
async function handleSwitchModeEvent(event) {
  const { mode } = event.detail;
  if (mode && MODES[Object.keys(MODES).find((k) => MODES[k] === mode)]) {
    // Only trigger API call if we have a cached selection (active chat context)
    if (cachedSelection) {
      currentMode = mode;
      if (Storage) {
        try {
          await Storage.set(STORAGE_KEYS.ACTIVE_MODE, mode);
        } catch (error) {
          Logger.warn("Failed to save active mode:", error);
        }
      }
      // Reset chat history to get fresh response for the new mode
      chatHistory = [];
      // Make a new API call with the new mode
      runMode(mode);
    }
  }
}

/**
 * Handle send message event
 */
function handleSendMessageEvent() {
  handleFollowUpSubmit();
}

/**
 * Handle delete chat event
 */
function handleDeleteChatEvent(event) {
  const { chatId } = event.detail;
  handleDeleteChat(chatId);
}

/**
 * Render sidebar content
 */
function renderSidebarContent() {
  if (!lockinWidget) {
    return;
  }

  const sidebarElement = lockinWidget.getSidebarElement();
  if (!sidebarElement) {
    return;
  }

  // Build each section separately
  const modesHtml = buildModeSelector();
  const chatHtml = buildChatSection();
  const historyHtml = buildHistorySection();

  // Render using sidebar's renderContent method
  lockinWidget.renderContent({
    modes: modesHtml,
    chat: chatHtml,
    history: historyHtml,
  });

  // Attach textarea and input listeners after rendering
  attachSidebarInputListeners(sidebarElement);

  scrollChatToBottom();
}

/**
 * Attach event listeners to sidebar input elements
 */
function attachSidebarInputListeners(sidebarElement) {
  const textarea = sidebarElement.querySelector(".lockin-chat-textarea");
  const sendBtn = sidebarElement.querySelector(".lockin-send-btn");

  if (textarea) {
    textarea.value = pendingInputValue;
    textarea.addEventListener("input", (e) => {
      pendingInputValue = e.target.value;
      if (sendBtn) {
        sendBtn.disabled =
          isChatLoading || pendingInputValue.trim().length === 0;
      }
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !isChatLoading) {
        e.preventDefault();
        if (sendBtn) sendBtn.click();
      }
    });
  }
}

/**
 * Build the chat section HTML
 */
function buildChatSection() {
  const chatHtml = buildChatMessagesHtml(chatHistory);
  const sendDisabled = isChatLoading || pendingInputValue.trim().length === 0;

  return `
    <div class="lockin-chat-messages">${chatHtml}</div>
    <div class="lockin-chat-input">
      <textarea class="lockin-chat-textarea" id="lockin-chat-input" name="lockin-chat-input" rows="2" placeholder="Ask a follow-up question..." ${
        isChatLoading ? "disabled" : ""
      }></textarea>
      <button class="lockin-send-btn" type="button" ${
        sendDisabled ? "disabled" : ""
      }>Send</button>
    </div>
  `;
}

/**
 * Build the history section HTML
 */
function buildHistorySection() {
  // Load chats if not already loaded
  if (!hasLoadedChats && !isHistoryLoading) {
    loadRecentChats({ silent: true });
  }

  const listHtml = recentChats.length
    ? recentChats
        .map((chat) => {
          const isActive = chat.id === currentChatId;
          return `
            <div class="lockin-history-item ${
              isActive ? "active" : ""
            }" data-chat-id="${chat.id}">
              <div class="lockin-history-item-content">
                <span class="lockin-history-title">${escapeHtml(
                  chat.title || buildFallbackHistoryTitle(chat)
                )}</span>
                <span class="lockin-history-meta">${escapeHtml(
                  formatHistoryTimestamp(
                    chat.last_message_at || chat.created_at
                  )
                )}</span>
              </div>
              <button class="lockin-history-item-menu" type="button" data-chat-id="${
                chat.id
              }" title="Delete chat" aria-label="Delete chat menu">
                <span class="lockin-menu-dots">&#8230;</span>
              </button>
            </div>
          `;
        })
        .join("")
    : `<p class="lockin-history-empty">${escapeHtml(
        isHistoryLoading ? "Loading chats..." : "No chats yet."
      )}</p>`;

  return `
    <div class="lockin-history-actions">
      <span class="lockin-history-label">Chats</span>
      <button class="lockin-new-chat-btn" type="button" ${
        isChatLoading ? "disabled" : ""
      }>+ New Chat</button>
    </div>
    <div class="lockin-history-list">${listHtml}</div>
  `;
}

/**
 * Apply theme by updating CSS variables
 */
function applyTheme() {
  // Get root element or create one if needed
  let root = document.documentElement;

  // Set CSS variables
  const isDark =
    currentTheme === THEMES.DARK ||
    (currentTheme === THEMES.SYSTEM &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const bgColor = isDark ? "#1a1a1a" : "#ffffff";
  const bgSoft = isDark ? "#2d2d2d" : "#f9fafb";
  const textColor = isDark ? "#e5e5e5" : "#1f2937";
  const borderColor = isDark ? "#404040" : "#e5e7eb";

  root.style.setProperty("--lockin-bg", bgColor);
  root.style.setProperty("--lockin-bg-soft", bgSoft);
  root.style.setProperty("--lockin-text", textColor);
  root.style.setProperty("--lockin-accent", currentAccentColor);
  root.style.setProperty("--lockin-border", borderColor);

  // Re-render sidebar if open
  if (lockinWidget && lockinWidget.isOpen) {
    renderSidebarContent();
  }
}

/**
 * Listen for storage changes (when user toggles in popup or changes settings)
 */
function listenToStorageChanges() {
  if (!Storage) {
    return;
  }

  Storage.onChanged((changes, areaName) => {
    if (areaName === "sync" && changes.highlightingEnabled) {
      highlightingEnabled = changes.highlightingEnabled.newValue;
    }

    // Theme changes
    if (areaName === "sync" && changes[STORAGE_KEYS.THEME]) {
      currentTheme = changes[STORAGE_KEYS.THEME].newValue;
      applyTheme();
    }

    // Accent color changes
    if (areaName === "sync" && changes[STORAGE_KEYS.ACCENT_COLOR]) {
      currentAccentColor = changes[STORAGE_KEYS.ACCENT_COLOR].newValue;
      applyTheme();
    }

    // Active mode changes
    if (areaName === "sync" && changes[STORAGE_KEYS.ACTIVE_MODE]) {
      currentMode = changes[STORAGE_KEYS.ACTIVE_MODE].newValue;
      if (lockinWidget && lockinWidget.isOpen) {
        renderSidebarContent();
      }
    }

    if (areaName === "local" && changes[CHAT_ID_STORAGE_KEY]) {
      currentChatId = changes[CHAT_ID_STORAGE_KEY].newValue || null;
      historyStatusMessage = "";
      if (!currentChatId) {
        chatHistory = [];
      }
      if (lockinWidget && lockinWidget.isOpen) {
        renderSidebarContent();
      }
    }
  });
}

/**
 * Setup event listeners for text selection
 */
function setupEventListeners() {
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyPress);
}

// ===================================
// Selection Handling
// ===================================

/**
 * Handle mouse up events - require Ctrl/Cmd + valid text selection
 */
function handleMouseUp(event) {
  // Check if highlighting is enabled
  if (!highlightingEnabled) {
    Logger.debug("Highlighting is disabled");
    return;
  }

  // Require modifier key (Ctrl on Windows/Linux, Cmd on macOS)
  const hasModifierKey = isMac ? event.metaKey : event.ctrlKey;

  Logger.debug("Mouse up detected", {
    isMac,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    hasModifierKey,
  });

  if (!hasModifierKey) {
    Logger.debug("Modifier key not pressed - ignoring selection");
    return;
  }

  Logger.debug("Modifier key pressed - processing selection");

  setTimeout(() => {
    const validationResult = validateSelection();
    if (!validationResult.valid) {
      Logger.debug("Selection validation failed");
      return;
    }

    Logger.debug("Valid selection detected, triggering AI");

    // Store selection info
    cachedSelection = validationResult.text;
    cachedRect = validationResult.rect;

    determineDefaultMode().then(() => {
      runMode(currentMode);
    });
  }, 50);
}

/**
 * Validate current selection
 * Returns { valid: boolean, text?: string, rect?: DOMRect }
 */
function validateSelection() {
  const selection = window.getSelection();

  // No selection
  if (!selection || selection.rangeCount === 0) {
    return { valid: false };
  }

  const selectedText = selection.toString().trim();

  // Empty or too short
  if (!selectedText || selectedText.length < MIN_SELECTION_LENGTH) {
    return { valid: false };
  }

  // Check if selection is inside input/textarea/contenteditable
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

  // Valid selection
  const rect = range.getBoundingClientRect();
  return {
    valid: true,
    text: selectedText,
    rect: rect,
  };
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyPress(event) {
  if (event.key === "Escape") {
    closeBubble();
  }
}

// ===================================
// Mode Management
// ===================================

/**
 * Determine which mode to use based on user preferences
 */
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
      STORAGE_KEYS.ACTIVE_MODE,
    ]);

    // First, check if there's a stored active mode from new system
    if (data[STORAGE_KEYS.ACTIVE_MODE]) {
      currentMode = data[STORAGE_KEYS.ACTIVE_MODE];
      return;
    }

    // Fall back to old system
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

/**
 * Run the selected mode with cached selection
 */
async function runMode(mode) {
  currentMode = mode;

  // Update lastUsedMode if preference is 'lastUsed'
  if (Storage) {
    try {
      const data = await Storage.get("modePreference");
      if (data.modePreference === "lastUsed") {
        await Storage.set("lastUsedMode", mode);
      }
    } catch (error) {
      Logger.warn("Storage access error:", error);
    }
  }

  const settings = await getSettings();
  sessionPreferences = {
    preferredLanguage: settings.preferredLanguage || "en",
    difficultyLevel: settings.difficultyLevel || "highschool",
  };

  const baseHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
  // Don't add original text to local history - just send selection to API
  const optimisticHistory = baseHistory;

  chatHistory = optimisticHistory;
  pendingInputValue = "";
  isChatLoading = true;

  ensureChatBubble();
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: true });

  try {
    const response = await callLockInApi({
      selection: cachedSelection,
      mode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: baseHistory,
      // Only send newUserMessage if we have existing chat history
      // For initial requests, the selection is sent to buildInitialHistory
      newUserMessage:
        baseHistory.length > 0 && cachedSelection
          ? `${cachedSelection}`
          : undefined,
    });

    // Handle new response format: { success: boolean, data?: {...}, error?: {...} }
    if (!response.success) {
      throw new Error(response.error?.message || "Request failed");
    }

    const data = response.data;
    if (!data || !data.explanation) {
      throw new Error("Invalid response format: missing explanation");
    }

    // Build chat history from structured response
    // Add user message if this is initial request
    if (baseHistory.length === 0 && cachedSelection) {
      chatHistory = [
        {
          role: "user",
          content: `Original text:\n${cachedSelection}`,
        },
      ];
    } else {
      chatHistory = [...baseHistory];
    }

    // Add assistant response
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content: data.explanation,
      },
    ];

    // Log notes, todos, tags, and difficulty for now (can be used later)
    if (data.notes && data.notes.length > 0) {
      Logger.debug("Notes received:", data.notes);
    }
    if (data.todos && data.todos.length > 0) {
      Logger.debug("Todos received:", data.todos);
    }
    if (data.tags && data.tags.length > 0) {
      Logger.debug("Tags received:", data.tags);
    }
    Logger.debug("Difficulty:", data.difficulty);

    isChatLoading = false;
    pendingInputValue = "";
    if (response.chatId) {
      currentChatId = response.chatId;
      await setStoredChatId(currentChatId);
    }
    historyStatusMessage = "";
    loadRecentChats({ silent: true });
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    Logger.error("Error processing request:", error);
    isChatLoading = false;

    if (cachedSelection) {
      const friendlyMessage = getAssistantErrorMessage(error);
      if (!baseHistory.length) {
        chatHistory = buildFallbackHistory();
      } else {
        chatHistory = baseHistory;
      }
      chatHistory = [
        ...chatHistory,
        {
          role: "assistant",
          content: friendlyMessage,
        },
      ];
      renderSidebarContent();
      saveSessionForCurrentTab();
    } else {
      // No existing selection context. Surface error in console.
      Logger.error("Error (no selection):", getAssistantErrorMessage(error));
    }
  }
}

/**
 * Get settings from storage
 */
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

async function callLockInApi(payload) {
  if (!API) {
    throw new Error("API module not available");
  }

  try {
    return await API.processText({
      selection: payload.selection ?? cachedSelection,
      mode: payload.mode ?? currentMode,
      targetLanguage:
        payload.targetLanguage || sessionPreferences.preferredLanguage || "en",
      difficultyLevel:
        payload.difficultyLevel ||
        sessionPreferences.difficultyLevel ||
        "highschool",
      chatHistory: payload.chatHistory ?? chatHistory ?? [],
      newUserMessage: payload.newUserMessage,
      chatId:
        typeof payload.chatId !== "undefined" ? payload.chatId : currentChatId,
    });
  } catch (error) {
    // Re-throw with original error code
    throw error;
  }
}

function buildFallbackHistory() {
  if (!cachedSelection) {
    return [];
  }

  return [
    {
      role: "user",
      content: `Original text:\n${cachedSelection}`,
    },
  ];
}

function getAssistantErrorMessage(error) {
  const code = error?.code;
  if (code === "AUTH_REQUIRED" || code === "AUTH_NOT_CONFIGURED") {
    return "Please open the Lock-in popup and sign in to your account before trying again.";
  }
  if (code === "RATE_LIMIT") {
    return "You reached today's request limit. Please try again tomorrow.";
  }
  return (
    error?.message ||
    "I had trouble reaching Lock-in. Please check your connection and try again."
  );
}

function handleFollowUpSubmit() {
  if (isChatLoading) {
    return;
  }

  const trimmed = pendingInputValue.trim();
  if (!trimmed) {
    return;
  }

  pendingInputValue = "";
  sendFollowUpMessage(trimmed);
}

async function sendFollowUpMessage(messageText) {
  chatHistory = [...chatHistory, { role: "user", content: messageText }];
  isChatLoading = true;
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: true });

  try {
    const historyForRequest = chatHistory.slice(0, -1);
    const response = await callLockInApi({
      selection: cachedSelection,
      mode: currentMode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: historyForRequest,
      newUserMessage: messageText,
      chatId: currentChatId,
    });

    // Handle new response format: { success: boolean, data?: {...}, error?: {...} }
    if (!response.success) {
      throw new Error(response.error?.message || "Request failed");
    }

    const data = response.data;
    if (!data || !data.explanation) {
      throw new Error("Invalid response format: missing explanation");
    }

    // Build chat history: user message is already added, now add assistant response
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content: data.explanation,
      },
    ];

    // Log notes, todos, tags, and difficulty for now (can be used later)
    if (data.notes && data.notes.length > 0) {
      Logger.debug("Notes received:", data.notes);
    }
    if (data.todos && data.todos.length > 0) {
      Logger.debug("Todos received:", data.todos);
    }
    if (data.tags && data.tags.length > 0) {
      Logger.debug("Tags received:", data.tags);
    }
    Logger.debug("Difficulty:", data.difficulty);

    isChatLoading = false;
    if (response.chatId) {
      currentChatId = response.chatId;
      await setStoredChatId(currentChatId);
    }
    historyStatusMessage = "";
    loadRecentChats({ silent: true });
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    Logger.error("Follow-up error:", error);
    isChatLoading = false;
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content: getAssistantErrorMessage(error),
      },
    ];
    renderChatBubble();
    saveSessionForCurrentTab();
  }
}

// ===================================
// Bubble Display Helpers (LockinSidebar-based)
// ===================================

/**
 * Ensure the sidebar is open and ready to render content.
 */
function ensureChatBubble() {
  if (!lockinWidget) {
    return;
  }

  if (!lockinWidget.isOpen) {
    lockinWidget.open();
  }
}

/**
 * Backwards-compatible helper used throughout older code paths.
 * Delegates to the new sidebar-based renderer.
 */
function renderChatBubble() {
  renderSidebarContent();
}

function scrollChatToBottom() {
  if (!lockinWidget) {
    return;
  }

  const sidebarElement = lockinWidget.getSidebarElement();
  if (!sidebarElement) {
    return;
  }

  requestAnimationFrame(() => {
    const messagesEl = sidebarElement.querySelector(".lockin-chat-messages");
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
}

function buildChatMessagesHtml(messages) {
  const filtered = (messages || []).filter(
    (message) => message.role !== "system"
  );

  if (filtered.length === 0) {
    const placeholderText = isChatLoading
      ? "Lock-in is thinking..."
      : "Highlight text and choose a mode to start chatting.";
    return `<div class="lockin-chat-placeholder">${escapeHtml(
      placeholderText
    )}</div>`;
  }

  const rendered = filtered
    .map((message) => {
      const roleClass =
        message.role === "user"
          ? "lockin-chat-msg-user"
          : "lockin-chat-msg-assistant";
      return `
        <div class="lockin-chat-msg ${roleClass}">
          <div class="lockin-chat-bubble">${escapeHtml(message.content)}</div>
        </div>
      `;
    })
    .join("");

  if (isChatLoading) {
    return (
      rendered +
      `
      <div class="lockin-chat-msg lockin-chat-msg-assistant lockin-chat-msg-pending">
        <div class="lockin-chat-bubble">
          <span class="lockin-dots"></span>Lock-in is thinking...
        </div>
      </div>
    `
    );
  }

  return rendered;
}

/**
 * Build the mode selector UI (expandable)
 * Shows current mode with chevron, expandable to show other modes
 */
function buildModeSelector() {
  const modeInfo = MODE_CONFIG[currentMode];
  const otherModes = Object.keys(MODES)
    .map((key) => MODES[key])
    .filter((mode) => mode !== currentMode);

  const otherModesHtml = otherModes
    .map((mode) => {
      const info = MODE_CONFIG[mode];
      return `
      <button class="lockin-mode-option" type="button" data-mode="${mode}" title="Switch to ${info.label}">
        <span class="lockin-mode-option-icon">${info.icon}</span>
        <span class="lockin-mode-option-label">${info.label}</span>
      </button>
    `;
    })
    .join("");

  return `
    <div class="lockin-mode-selector-container">
      <button class="lockin-mode-pill" type="button" title="Current mode">
        <span class="lockin-mode-icon">${modeInfo.icon}</span>
        <span class="lockin-mode-label">${modeInfo.label}</span>
        <span class="lockin-mode-chevron">&#9660;</span>
      </button>
      <div class="lockin-mode-expandable" style="display: none;">
        ${otherModesHtml}
      </div>
    </div>
  `;
}

function buildHistoryPanelHtml() {
  const panelState = isHistoryPanelOpen ? "open" : "collapsed";
  const statusHtml = historyStatusMessage
    ? `<p class="lockin-history-status">${escapeHtml(historyStatusMessage)}</p>`
    : "";
  const listHtml = recentChats.length
    ? recentChats
        .map((chat) => {
          const isActive = chat.id === currentChatId;
          return `
            <div class="lockin-history-item ${
              isActive ? "active" : ""
            }" data-chat-id="${chat.id}">
              <div class="lockin-history-item-content">
                <span class="lockin-history-title">${escapeHtml(
                  chat.title || buildFallbackHistoryTitle(chat)
                )}</span>
                <span class="lockin-history-meta">${escapeHtml(
                  formatHistoryTimestamp(
                    chat.last_message_at || chat.created_at
                  )
                )}</span>
              </div>
              <button class="lockin-history-item-menu" type="button" data-chat-id="${
                chat.id
              }" title="Delete chat" aria-label="Delete chat menu">
                <span class="lockin-menu-dots">&#8230;</span>
              </button>
            </div>
          `;
        })
        .join("")
    : `<p class="lockin-history-empty">${escapeHtml(
        isHistoryLoading ? "Loading chats..." : "No chats yet."
      )}</p>`;

  return `
    <aside class="lockin-history-panel ${panelState}">
      <div class="lockin-history-actions">
        <span class="lockin-history-label">Chats</span>
        <button class="lockin-new-chat-btn" type="button" ${
          isChatLoading ? "disabled" : ""
        }>+ New Chat</button>
      </div>
      ${statusHtml}
      <div class="lockin-history-list">${listHtml}</div>
      ${buildUserProfileBlock()}
    </aside>
  `;
}

/**
 * Build user profile card at the bottom of the sidebar
 */
function buildUserProfileBlock() {
  const initials = userProfile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return `
    <div class="lockin-profile-section">
      <button class="lockin-profile-card" type="button" title="User settings">
        <div class="lockin-profile-avatar">${escapeHtml(initials)}</div>
        <div class="lockin-profile-info">
          <div class="lockin-profile-name">${escapeHtml(userProfile.name)}</div>
          <div class="lockin-profile-plan">${escapeHtml(userProfile.plan)}</div>
        </div>
      </button>
      <div class="lockin-profile-menu" style="display: none;">
        ${buildProfileMenu()}
      </div>
    </div>
  `;
}

/**
 * Build profile menu options
 */
function buildProfileMenu() {
  return `
    <button class="lockin-profile-menu-item" type="button" data-action="upgrade">
      Upgrade plan
    </button>
    <button class="lockin-profile-menu-item" type="button" data-action="personalisation">
      Personalisation
    </button>
    <button class="lockin-profile-menu-item" type="button" data-action="settings">
      Settings
    </button>
    <button class="lockin-profile-menu-item" type="button" data-action="help">
      Help
    </button>
    <div class="lockin-profile-menu-divider"></div>
    <button class="lockin-profile-menu-item lockin-profile-menu-logout" type="button" data-action="logout">
      Log out
    </button>
  `;
}

function buildFallbackHistoryTitle(chat) {
  // Prefer shared utility if available for easier testing.
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.buildFallbackHistoryTitle === "function"
  ) {
    return LockInChatHistoryUtils.buildFallbackHistoryTitle(chat);
  }

  if (!chat) {
    return "Untitled chat";
  }
  const timestamp = chat.created_at || chat.updated_at;
  if (!timestamp) {
    return "Untitled chat";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Untitled chat";
  }
  return `Chat from ${date.toISOString().split("T")[0]}`;
}

function formatHistoryTimestamp(timestamp) {
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.formatHistoryTimestamp === "function"
  ) {
    return LockInChatHistoryUtils.formatHistoryTimestamp(timestamp);
  }

  if (!timestamp) {
    return "Just now";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) {
    return minutes <= 1 ? "Just now" : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString();
}

async function handleNewChatRequest() {
  await startNewChat("New chat ready. Highlight text to start.");
}

async function startNewChat(statusMessage) {
  currentChatId = null;
  chatHistory = [];
  pendingInputValue = "";
  await setStoredChatId(null);
  historyStatusMessage = statusMessage || "";
  isChatLoading = false;
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: false });
}

async function handleHistorySelection(chatId) {
  if (!chatId) {
    return;
  }
  historyStatusMessage = "Loading chat...";
  renderChatBubble();
  try {
    const rows = await fetchChatMessagesFromApi(chatId);
    const restoredHistory = convertRowsToChatHistory(rows);
    chatHistory = restoredHistory.length
      ? restoredHistory
      : [
          {
            role: "assistant",
            content: "This chat is empty. Highlight text to add a message.",
          },
        ];
    currentChatId = chatId;
    pendingInputValue = "";
    await setStoredChatId(chatId);
    historyStatusMessage = "";
    isChatLoading = false;
    renderChatBubble();
    saveSessionForCurrentTab({ isLoadingOverride: false });
    loadRecentChats({ silent: true });
  } catch (error) {
    Logger.error("Chat load error:", error);
    historyStatusMessage =
      error?.message || "Unable to load that chat. Please try again.";
    renderChatBubble();
  }
}
function showDeleteDropdown(menuBtn, chatId) {
  // Remove any existing dropdown
  const existingDropdown = document.querySelector(".lockin-delete-dropdown");
  if (existingDropdown) {
    existingDropdown.remove();
  }

  // Create dropdown menu
  const dropdown = document.createElement("div");
  dropdown.className = "lockin-delete-dropdown";
  dropdown.innerHTML = `
    <button class="lockin-delete-dropdown-item" type="button" data-chat-id="${chatId}">
      <span class="lockin-delete-dropdown-icon">&#128465;</span>
      <span class="lockin-delete-dropdown-text">Delete</span>
    </button>
  `;

  // Position dropdown near the menu button
  const rect = menuBtn.getBoundingClientRect();
  dropdown.style.top = rect.bottom + 4 + "px";
  dropdown.style.left = rect.right - 140 + "px";
  dropdown.style.zIndex = "10001";

  document.body.appendChild(dropdown);

  // Handle delete click
  dropdown
    .querySelector(".lockin-delete-dropdown-item")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.remove();
      handleDeleteChat(chatId);
    });

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener("click", closeDropdown);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", closeDropdown);
  }, 0);
}

async function handleDeleteChat(chatId) {
  if (!API) {
    alert("Please sign in to delete chats.");
    return;
  }

  try {
    await API.deleteChat(chatId);

    // If deleted chat is currently open, switch to new chat
    if (currentChatId === chatId) {
      await startNewChat("Chat deleted. Starting new chat.");
    }

    loadRecentChats({ silent: true });
  } catch (error) {
    Logger.error("Error deleting chat:", error);
    alert("Failed to delete chat. Please try again.");
  }
}

async function loadRecentChats(options = {}) {
  if (isHistoryLoading) {
    return;
  }

  const silent = options.silent === true;

  if (!API) {
    if (!silent) {
      historyStatusMessage = "Sign in via the popup to see your chats.";
      if (lockinWidget && lockinWidget.isOpen) {
        renderSidebarContent();
      }
    }
    return;
  }

  isHistoryLoading = true;
  if (!silent) {
    historyStatusMessage = "Loading chats...";
    if (lockinWidget && lockinWidget.isOpen) {
      renderSidebarContent();
    }
  }

  try {
    const data = await API.getRecentChats({ limit: RECENT_CHAT_LIMIT });
    recentChats = Array.isArray(data) ? data : [];
    hasLoadedChats = true;
    if (!silent) {
      historyStatusMessage = recentChats.length
        ? ""
        : "Start a new chat to see it here.";
    }
  } catch (error) {
    Logger.error("Recent chats error:", error);
    if (!silent) {
      historyStatusMessage =
        error?.message || "Unable to load chats right now.";
    }
  } finally {
    isHistoryLoading = false;
    hasLoadedChats = true;
    if (lockinWidget && lockinWidget.isOpen) {
      renderSidebarContent();
    }
  }
}

async function fetchChatMessagesFromApi(chatId) {
  if (!API) {
    throw new Error("API module not available");
  }

  try {
    return await API.getChatMessages(chatId);
  } catch (error) {
    throw error;
  }
}

function convertRowsToChatHistory(rows = []) {
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.convertRowsToChatHistory === "function"
  ) {
    return LockInChatHistoryUtils.convertRowsToChatHistory(rows);
  }

  return rows
    .map((row) => {
      const role = row.role || "assistant";
      const text =
        role === "assistant"
          ? row.output_text || ""
          : row.input_text || row.output_text || "";
      if (!text) {
        return null;
      }
      return { role, content: text };
    })
    .filter(Boolean);
}

function scrollChatToBottom() {
  if (!lockinWidget) {
    return;
  }

  const bubbleElement = lockinWidget.getBubbleElement();
  if (!bubbleElement) {
    return;
  }

  requestAnimationFrame(() => {
    const messagesEl = bubbleElement.querySelector(".lockin-chat-messages");
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
}

// Legacy standalone error bubble and manual positioning have been removed.

// ===================================
// Per-Tab Session Management
// ===================================

/**
 * Get current tab ID from background script
 */
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

/**
 * Load session for current tab
 */
async function loadSessionForCurrentTab() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.GET_SESSION
    );
    const response = await Messaging.sendMessage(message);
    if (!response.ok) {
      return;
    }
    const session = response.data?.session;

    // No session exists
    if (!session || !session.isActive) return;

    // Check if origin matches
    if (session.origin !== currentOrigin) {
      Logger.debug("Origin changed, not restoring session");
      await clearSessionForCurrentTab();
      return;
    }

    // Check if user explicitly closed it
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

    let restoredHistory = Array.isArray(session.chatHistory)
      ? session.chatHistory
      : [];

    if (!restoredHistory.length && session.data) {
      restoredHistory = migrateLegacySession(session);
    }

    chatHistory = restoredHistory;
    pendingInputValue = "";
    isChatLoading = !!session.isLoading;
    if (session.chatId) {
      currentChatId = session.chatId;
      setStoredChatId(session.chatId);
    }

    if (!chatHistory.length && isChatLoading && cachedSelection) {
      runMode(currentMode);
      return;
    }

    if (chatHistory.length) {
      ensureChatBubble();
      renderChatBubble();
    }
  } catch (error) {
    Logger.error("Failed to load session:", error);
  }
}

function migrateLegacySession(session) {
  if (!session || !session.data) {
    return [];
  }

  const legacyHistory = [];

  if (session.selection) {
    legacyHistory.push({
      role: "user",
      content: `Original text:\n${session.selection}`,
    });
  }

  const parts = [];
  if (session.data.answer) {
    parts.push(session.data.answer);
  }
  if (session.data.example) {
    parts.push(`Example:\n${session.data.example}`);
  }
  if (session.data.explanation) {
    parts.push(`Explanation:\n${session.data.explanation}`);
  }

  if (parts.length) {
    legacyHistory.push({
      role: "assistant",
      content: parts.join("\n\n"),
    });
  }

  return legacyHistory;
}

function listenToAuthChanges() {
  if (
    !window.LockInAuth ||
    typeof window.LockInAuth.onSessionChanged !== "function"
  ) {
    return;
  }

  window.LockInAuth.onSessionChanged((session) => {
    if (session && session.accessToken) {
      return;
    }
    currentChatId = null;
    recentChats = [];
    historyStatusMessage = "";
    hasLoadedChats = false;
    setStoredChatId(null);
    if (lockinWidget && lockinWidget.isOpen) {
      renderBubbleContent();
    }
  });
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

/**
 * Save session for current tab
 */
async function saveSessionForCurrentTab(options = {}) {
  if (!chrome.runtime || !currentTabId) return;

  const sessionData = {
    tabId: currentTabId,
    origin: currentOrigin,
    isActive: true,
    isClosed: false,
    timestamp: Date.now(),
    isLoading:
      typeof options.isLoadingOverride === "boolean"
        ? options.isLoadingOverride
        : isChatLoading,
    selection: cachedSelection,
    mode: currentMode,
    chatHistory: chatHistory,
    chatId: currentChatId,
    targetLanguage: sessionPreferences.preferredLanguage,
    difficultyLevel: sessionPreferences.difficultyLevel,
  };

  if (!Messaging || !chrome.runtime) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.SAVE_SESSION,
      { sessionData }
    );
    await Messaging.sendMessage(message);
  } catch (error) {
    Logger.error("Failed to save session:", error);
  }
}

/**
 * Update just the position/size in the current session
 */
async function updateSessionPosition() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    // Get current session
    const getMessage = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.GET_SESSION
    );
    const getResponse = await Messaging.sendMessage(getMessage);
    if (getResponse.ok && getResponse.data?.session) {
      const session = getResponse.data.session;
      const saveMessage = Messaging.createMessage(
        Messaging.MESSAGE_TYPES.SAVE_SESSION,
        { sessionData: session }
      );
      await Messaging.sendMessage(saveMessage);
    }
  } catch (error) {
    Logger.error("Failed to update session position:", error);
  }
}

/**
 * Clear session for current tab
 */
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

/**
 * Close bubble and mark session as closed
 */
async function closeBubble() {
  if (lockinWidget) {
    lockinWidget.close();
  }
}

// ===================================
// Utility Functions
// ===================================

/**
 * Handle profile menu actions
 */
function handleProfileMenuAction(action) {
  switch (action) {
    case "upgrade":
      Logger.debug("TODO: Handle upgrade plan action");
      break;
    case "personalisation":
      isPersonalisationPanelOpen = !isPersonalisationPanelOpen;
      renderPersonalisationPanel();
      break;
    case "settings":
      Logger.debug("TODO: Handle settings action");
      break;
    case "help":
      Logger.debug("TODO: Handle help action");
      break;
    case "logout":
      handleLogout();
      break;
    default:
      Logger.debug(`Unknown profile action: ${action}`);
  }
}

/**
 * Handle logout
 */
function handleLogout() {
  // Call existing auth logout if available
  if (window.LockInAuth && typeof window.LockInAuth.logout === "function") {
    window.LockInAuth.logout();
  } else {
    Logger.debug("Logout handler not available");
  }
}

/**
 * Render personalisation panel
 */
function renderPersonalisationPanel() {
  // TODO: Implement personalisation panel UI
  Logger.debug("Opening personalisation panel");
}

/**
 * Get mode info (icon and label)
 */
function getModeInfo(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG[MODES.EXPLAIN];
}

/**
 * Set current mode as default
 */
async function setAsDefault(mode) {
  if (!Storage) {
    return;
  }

  try {
    await Storage.set({
      defaultMode: mode,
      modePreference: "fixed",
    });

    const btn =
      lockinWidget && lockinWidget.getBubbleElement()
        ? lockinWidget.getBubbleElement().querySelector(".lockin-set-default")
        : null;
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span style="font-size: 11px;">&check;</span>';
    btn.style.color = "#10b981";
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.color = "";
    }, 1500);
  } catch (error) {
    Logger.warn("Failed to set default mode:", error);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.escapeHtml === "function"
  ) {
    return LockInChatHistoryUtils.escapeHtml(text);
  }

  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===================================
// Safe Initialization
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
