/**
 * Lock-in Content Script - Contextual AI Assistant
 * Features:
 * - Modifier key requirement (Ctrl/Cmd + selection)
 * - Smart contextual bubble placement
 * - Draggable response bubble
 * - On/off toggle via popup
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

// Storage keys for chrome.storage.sync
const STORAGE_KEYS = {
  BUBBLE_OPEN: "lockinBubbleOpen",
  ACTIVE_MODE: "lockinActiveMode",
  THEME: "lockinTheme",
  ACCENT_COLOR: "lockinAccentColor",
  BUBBLE_POSITION: "lockinBubblePosition",
  BUBBLE_SIZE: "lockinBubbleSize",
  USER_PROFILE: "lockinUserProfile",
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

// ===================================
// Load persisted UI preferences
// ===================================
function loadToggleState() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  chrome.storage.sync.get(["highlightingEnabled"], (data) => {
    // Default to true when not explicitly disabled
    highlightingEnabled = data.highlightingEnabled !== false;
  });
}

function loadThemeAndPersonalisation() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  chrome.storage.sync.get(
    [
      STORAGE_KEYS.THEME,
      STORAGE_KEYS.ACCENT_COLOR,
      STORAGE_KEYS.ACTIVE_MODE,
      STORAGE_KEYS.USER_PROFILE,
    ],
    (data) => {
      currentTheme = data[STORAGE_KEYS.THEME] || THEMES.LIGHT;
      currentAccentColor = data[STORAGE_KEYS.ACCENT_COLOR] || "#667eea";
      currentMode = data[STORAGE_KEYS.ACTIVE_MODE] || MODES.EXPLAIN;
      if (data[STORAGE_KEYS.USER_PROFILE]) {
        userProfile = data[STORAGE_KEYS.USER_PROFILE];
      }
      applyTheme();
    }
  );
}

// ===================================
// Initialization
// ===================================
function init() {
  loadToggleState();
  loadThemeAndPersonalisation();
  listenToStorageChanges();
  setupEventListeners();
  loadStoredChatId();
  listenToAuthChanges();

  // Initialize widget system
  if (typeof LockinWidget !== "undefined") {
    initializeWidget();
  }

  // Get tab ID and restore session if available
  getTabId().then(() => {
    setTimeout(loadSessionForCurrentTab, 500);
  });
}

/**
 * Initialize the Lock-in widget
 */
function initializeWidget() {
  lockinWidget = new LockinWidget({
    autoOpenOnSelection: false,
  });
  lockinWidget.init();

  // Listen to widget events
  window.addEventListener("lockin:open", handleWidgetOpen);
  window.addEventListener("lockin:close", handleWidgetClose);
}

/**
 * Handle widget open event
 */
function handleWidgetOpen() {
  isBubbleOpen = true;
  chrome.storage.sync.set({ [STORAGE_KEYS.BUBBLE_OPEN]: true });
  renderBubbleContent();
}

/**
 * Handle widget close event
 */
function handleWidgetClose() {
  isBubbleOpen = false;
  chrome.storage.sync.set({ [STORAGE_KEYS.BUBBLE_OPEN]: false });
}

/**
 * Render bubble content into widget
 */
function renderBubbleContent() {
  if (!lockinWidget) {
    return;
  }

  const bubbleElement = lockinWidget.getBubbleElement();
  // Keep a reference so legacy helpers (scrollChatToBottom, etc.) can work
  // with the widget-based bubble element.
  activeBubble = bubbleElement;
  const chatHtml = buildChatMessagesHtml(chatHistory);
  const sendDisabled = isChatLoading || pendingInputValue.trim().length === 0;
  const layoutClass = isHistoryPanelOpen
    ? "lockin-history-open"
    : "lockin-history-collapsed";

  if (!hasLoadedChats && !isHistoryLoading) {
    loadRecentChats({ silent: true });
  }

  bubbleElement.innerHTML = `
    <div class="lockin-bubble-layout ${layoutClass}">
      ${buildHistoryPanelHtml()}
      <div class="lockin-chat-panel">
        <div class="lockin-bubble-header lockin-drag-handle">
          <div class="lockin-header-left">
            <button class="lockin-history-toggle" title="Toggle chat history">
              ${isHistoryPanelOpen ? "&lt;" : "&gt;"}
            </button>
            ${buildModeSelector()}
          </div>
          <div class="lockin-header-right">
            <button class="lockin-set-default" title="Set as default mode">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="lockin-minimize-bubble" title="Minimize">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button class="lockin-close-bubble">&times;</button>
          </div>
        </div>
        <div class="lockin-chat-body">
          <div class="lockin-chat-messages">${chatHtml}</div>
          <div class="lockin-chat-input">
            <textarea class="lockin-chat-textarea" rows="2" placeholder="Ask a follow-up question..." ${
              isChatLoading ? "disabled" : ""
            }></textarea>
            <button class="lockin-send-btn" ${
              sendDisabled ? "disabled" : ""
            }>Send</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachBubbleEventListeners(bubbleElement);
  scrollChatToBottom();
}

/**
 * Attach event listeners to bubble content
 */
function attachBubbleEventListeners(bubbleElement) {
  // Close button
  const closeBtn = bubbleElement.querySelector(".lockin-close-bubble");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      lockinWidget.close();
    });
  }

  // Minimize button
  const minimizeBtn = bubbleElement.querySelector(".lockin-minimize-bubble");
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      lockinWidget.close();
    });
  }

  // History toggle
  const historyToggle = bubbleElement.querySelector(".lockin-history-toggle");
  if (historyToggle) {
    historyToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      isHistoryPanelOpen = !isHistoryPanelOpen;
      renderBubbleContent();
    });
  }

  // Chat input and send button
  const textarea = bubbleElement.querySelector(".lockin-chat-textarea");
  const sendBtn = bubbleElement.querySelector(".lockin-send-btn");

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

  if (sendBtn) {
    sendBtn.addEventListener("click", () => handleFollowUpSubmit());
  }

  // Set default mode button
  const setDefaultBtn = bubbleElement.querySelector(".lockin-set-default");
  if (setDefaultBtn) {
    setDefaultBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.storage.sync.set(
        { [STORAGE_KEYS.ACTIVE_MODE]: currentMode },
        () => {
          setDefaultBtn.style.filter = "brightness(0.8)";
          setTimeout(() => {
            setDefaultBtn.style.filter = "";
          }, 200);
        }
      );
    });
  }

  // Mode selector
  const modePill = bubbleElement.querySelector(".lockin-mode-pill");
  const modeExpandable = bubbleElement.querySelector(".lockin-mode-expandable");
  if (modePill && modeExpandable) {
    modePill.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = modeExpandable.style.display !== "none";
      modeExpandable.style.display = isVisible ? "none" : "flex";
    });

    modeExpandable.querySelectorAll(".lockin-mode-option").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newMode = btn.dataset.mode;
        if (newMode && newMode !== currentMode) {
          currentMode = newMode;
          chrome.storage.sync.set({ [STORAGE_KEYS.ACTIVE_MODE]: newMode });
          modeExpandable.style.display = "none";
          startNewChat();
        }
      });
    });

    document.addEventListener(
      "click",
      () => {
        modeExpandable.style.display = "none";
      },
      { once: true }
    );
  }

  // History items and delete buttons
  bubbleElement
    .querySelectorAll(".lockin-history-item-content")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const chatId = item
          .closest(".lockin-history-item")
          ?.getAttribute("data-chat-id");
        if (!chatId || chatId === currentChatId) {
          return;
        }
        handleHistorySelection(chatId);
      });
    });

  bubbleElement
    .querySelectorAll(".lockin-history-item-menu")
    .forEach((menuBtn) => {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const chatId = menuBtn
          .closest(".lockin-history-item")
          ?.getAttribute("data-chat-id");
        if (chatId) {
          showDeleteDropdown(menuBtn, chatId);
        }
      });
    });

  // New chat button
  const newChatBtn = bubbleElement.querySelector(".lockin-new-chat-btn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await handleNewChatRequest();
    });
  }

  // Profile card and menu
  const profileCard = bubbleElement.querySelector(".lockin-profile-card");
  const profileMenu = bubbleElement.querySelector(".lockin-profile-menu");

  if (profileCard && profileMenu) {
    const toggleProfileMenu = (e) => {
      e.stopPropagation();
      const isVisible = profileMenu.style.display !== "none";
      profileMenu.style.display = isVisible ? "none" : "block";
    };

    profileCard.addEventListener("click", toggleProfileMenu);

    // Close the menu when clicking outside the profile section
    const closeOnOutsideClick = (event) => {
      if (
        !profileMenu.contains(event.target) &&
        !profileCard.contains(event.target)
      ) {
        profileMenu.style.display = "none";
        document.removeEventListener("click", closeOnOutsideClick);
      }
    };

    // Register the outside‑click listener once the menu is opened
    profileCard.addEventListener("click", () => {
      document.addEventListener("click", closeOnOutsideClick);
    });

    // Profile menu item actions
    profileMenu
      .querySelectorAll(".lockin-profile-menu-item")
      .forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = item.getAttribute("data-action");
          if (action) {
            handleProfileMenuAction(action);
          }
          profileMenu.style.display = "none";
        });
      });
  }

  // Allow dragging the entire widget by the bubble header.
  const dragHandle = bubbleElement.querySelector(".lockin-drag-handle");
  if (dragHandle && lockinWidget && typeof lockinWidget.startDrag === "function") {
    dragHandle.style.cursor = "grab";
    dragHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      // Only drag on left or middle click
      if (e.button !== 0 && e.button !== 1) {
        return;
      }
      lockinWidget.startDrag(e);
    });
  }
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

  // Re-render bubble if the widget is open
  if (lockinWidget && lockinWidget.isOpen) {
    renderBubbleContent();
  }
}

/**
 * Listen for storage changes (when user toggles in popup or changes settings)
 */
function listenToStorageChanges() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
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
        renderBubbleContent();
      }
    }

    if (areaName === "local" && changes[CHAT_ID_STORAGE_KEY]) {
      currentChatId = changes[CHAT_ID_STORAGE_KEY].newValue || null;
      historyStatusMessage = "";
      if (!currentChatId) {
        chatHistory = [];
      }
      if (lockinWidget && lockinWidget.isOpen) {
        renderBubbleContent();
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
 * Handle mouse up events - check for modifier key + valid selection
 */
function handleMouseUp(event) {
  // Check if highlighting is enabled
  if (!highlightingEnabled) {
    console.log("Lock-in: Highlighting is disabled");
    return;
  }

  // Ignore if we just finished dragging the bubble
  // (widget handles its own drag state; no legacy drag flag needed)

  // Check if required modifier key is pressed
  const hasModifierKey = isMac ? event.metaKey : event.ctrlKey;

  console.log("Lock-in: Mouse up detected", {
    isMac,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    hasModifierKey,
  });

  if (!hasModifierKey) {
    console.log("Lock-in: Modifier key not pressed - ignoring selection");
    return;
  }

  console.log("Lock-in: Modifier key pressed - processing selection");

  setTimeout(() => {
    const validationResult = validateSelection();
    if (!validationResult.valid) {
      console.log("Lock-in: Selection validation failed");
      return;
    }

    console.log("Lock-in: Valid selection detected, triggering AI");

    // Store selection info
    cachedSelection = validationResult.text;
    cachedRect = validationResult.rect;

    // If bubble exists, we don't remove it, we just update it
    // removeExistingBubble(); // Removed this line

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
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      currentMode = MODES.EXPLAIN;
      resolve();
      return;
    }

    try {
      chrome.storage.sync.get(
        [
          "modePreference",
          "defaultMode",
          "lastUsedMode",
          STORAGE_KEYS.ACTIVE_MODE,
        ],
        (data) => {
          if (chrome.runtime.lastError) {
            console.log(
              "Lock-in: Mode preference error:",
              chrome.runtime.lastError
            );
            currentMode = MODES.EXPLAIN;
            resolve();
            return;
          }

          // First, check if there's a stored active mode from new system
          if (data[STORAGE_KEYS.ACTIVE_MODE]) {
            currentMode = data[STORAGE_KEYS.ACTIVE_MODE];
            resolve();
            return;
          }

          // Fall back to old system
          const modePref = data.modePreference || "fixed";

          if (modePref === "lastUsed" && data.lastUsedMode) {
            currentMode = data.lastUsedMode;
          } else {
            currentMode = data.defaultMode || MODES.EXPLAIN;
          }

          resolve();
        }
      );
    } catch (error) {
      console.log("Lock-in: Mode determination error:", error);
      currentMode = MODES.EXPLAIN;
      resolve();
    }
  });
}

/**
 * Run the selected mode with cached selection
 */
async function runMode(mode) {
  currentMode = mode;

  // Update lastUsedMode if preference is 'lastUsed'
  if (typeof chrome !== "undefined" && chrome.storage) {
    try {
      chrome.storage.sync.get(["modePreference"], (data) => {
        if (chrome.runtime.lastError) {
          console.log("Lock-in: Storage get error:", chrome.runtime.lastError);
          return;
        }
        if (data.modePreference === "lastUsed") {
          chrome.storage.sync.set({ lastUsedMode: mode }, () => {
            if (chrome.runtime.lastError) {
              console.log(
                "Lock-in: Storage set error:",
                chrome.runtime.lastError
              );
            }
          });
        }
      });
    } catch (error) {
      console.log("Lock-in: Storage access error:", error);
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
    const data = await callLockInApi({
      selection: cachedSelection,
      mode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: baseHistory,
      newUserMessage: cachedSelection ? `${cachedSelection}` : undefined,
    });

    chatHistory = data.chatHistory || [];
    isChatLoading = false;
    pendingInputValue = "";
    if (data.chatId) {
      currentChatId = data.chatId;
      await setStoredChatId(currentChatId);
    }
    historyStatusMessage = "";
    loadRecentChats({ silent: true });
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    console.error("Lock-in error:", error);
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
      renderChatBubble();
      saveSessionForCurrentTab();
    } else {
      // No existing selection context to attach a chat bubble to.
      // Surface a friendly error message in the console instead of
      // attempting to render a separate legacy error bubble.
      console.error("Lock-in error (no selection):", getAssistantErrorMessage(error));
    }
  }
}

/**
 * Get settings from storage
 */
function getSettings() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve({ preferredLanguage: "en", difficultyLevel: "highschool" });
      return;
    }

    try {
      chrome.storage.sync.get(
        ["preferredLanguage", "difficultyLevel"],
        (data) => {
          if (chrome.runtime.lastError) {
            console.log(
              "Lock-in: Settings get error:",
              chrome.runtime.lastError
            );
            resolve({ preferredLanguage: "en", difficultyLevel: "highschool" });
            return;
          }
          resolve(data);
        }
      );
    } catch (error) {
      console.log("Lock-in: Settings access error:", error);
      resolve({ preferredLanguage: "en", difficultyLevel: "highschool" });
    }
  });
}

async function callLockInApi(payload) {
  const auth = window.LockInAuth;
  if (!auth || typeof auth.getValidAccessToken !== "function") {
    const setupError = new Error(
      "Authentication is not configured. Please update the extension settings."
    );
    setupError.code = "AUTH_NOT_CONFIGURED";
    throw setupError;
  }

  const accessToken = await auth.getValidAccessToken();

  if (!accessToken) {
    const authError = new Error(
      "Please sign in via the Lock-in popup before using the assistant."
    );
    authError.code = "AUTH_REQUIRED";
    throw authError;
  }

  const historyForRequest = payload.chatHistory ?? chatHistory ?? [];
  const normalizedHistory = historyForRequest
    .filter(
      (message) =>
        message &&
        typeof message.role === "string" &&
        typeof message.content === "string"
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const body = {
    selection: payload.selection ?? cachedSelection,
    mode: payload.mode ?? currentMode,
    targetLanguage:
      payload.targetLanguage || sessionPreferences.preferredLanguage || "en",
    difficultyLevel:
      payload.difficultyLevel ||
      sessionPreferences.difficultyLevel ||
      "highschool",
    chatHistory: normalizedHistory,
  };

  if (payload.newUserMessage) {
    body.newUserMessage = payload.newUserMessage;
  }

  const chatIdToSend =
    typeof payload.chatId !== "undefined" ? payload.chatId : currentChatId;
  if (chatIdToSend) {
    body.chatId = chatIdToSend;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(`${BACKEND_URL}/api/lockin`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).catch((networkError) => {
    const err = new Error(
      "Unable to reach Lock-in. Please check your connection."
    );
    err.cause = networkError;
    throw err;
  });

  if (response.status === 401 || response.status === 403) {
    if (typeof auth.signOut === "function") {
      await auth.signOut();
    }
  }

  if (!response.ok) {
    let errorMessage = "API request failed";
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody?.message || errorBody?.error || JSON.stringify(errorBody);
    } catch (_) {
      const fallbackText = await response.text();
      if (fallbackText) {
        errorMessage = fallbackText;
      }
    }

    const apiError = new Error(errorMessage || "API request failed");
    if (response.status === 429) {
      apiError.code = "RATE_LIMIT";
    } else if (response.status === 401 || response.status === 403) {
      apiError.code = "AUTH_REQUIRED";
    }
    throw apiError;
  }

  return response.json();
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
    const data = await callLockInApi({
      selection: cachedSelection,
      mode: currentMode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: historyForRequest,
      newUserMessage: messageText,
      chatId: currentChatId,
    });

    chatHistory = data.chatHistory || [];
    isChatLoading = false;
    if (data.chatId) {
      currentChatId = data.chatId;
      await setStoredChatId(currentChatId);
    }
    historyStatusMessage = "";
    loadRecentChats({ silent: true });
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    console.error("Lock-in follow-up error:", error);
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
// Bubble Display Helpers (LockinWidget-based)
// ===================================

/**
 * Ensure the widget bubble is open and ready to render content.
 */
function ensureChatBubble() {
  if (!lockinWidget) {
    return;
  }

  if (!lockinWidget.isOpen) {
    lockinWidget.open();
  }

  activeBubble = lockinWidget.getBubbleElement();
}

/**
 * Backwards-compatible helper used throughout older code paths.
 * Delegates to the new widget-based renderer.
 */
function renderChatBubble() {
  renderBubbleContent();
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
      <button class="lockin-mode-option" data-mode="${mode}" title="Switch to ${info.label}">
        <span class="lockin-mode-option-icon">${info.icon}</span>
        <span class="lockin-mode-option-label">${info.label}</span>
      </button>
    `;
    })
    .join("");

  return `
    <div class="lockin-mode-selector-container">
      <button class="lockin-mode-pill" title="Current mode">
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
              <button class="lockin-history-item-menu" data-chat-id="${
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
        <button class="lockin-new-chat-btn" ${
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
      <button class="lockin-profile-card" title="User settings">
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
    <button class="lockin-profile-menu-item" data-action="upgrade">
      Upgrade plan
    </button>
    <button class="lockin-profile-menu-item" data-action="personalisation">
      Personalisation
    </button>
    <button class="lockin-profile-menu-item" data-action="settings">
      Settings
    </button>
    <button class="lockin-profile-menu-item" data-action="help">
      Help
    </button>
    <div class="lockin-profile-menu-divider"></div>
    <button class="lockin-profile-menu-item lockin-profile-menu-logout" data-action="logout">
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
    console.error("Lock-in chat load error:", error);
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
    <button class="lockin-delete-dropdown-item" data-chat-id="${chatId}">
      <span class="lockin-delete-dropdown-icon">🗑️</span>
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
  try {
    const auth = window.LockInAuth;
    if (!auth || typeof auth.getValidAccessToken !== "function") {
      alert("Please sign in to delete chats.");
      return;
    }

    const accessToken = await auth.getValidAccessToken();
    if (!accessToken) {
      alert("Unable to verify your identity. Please sign in again.");
      return;
    }

    // Call backend to delete chat
    const response = await fetch(`${BACKEND_URL}/api/chats/${chatId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    // If deleted chat is currently open, switch to new chat
    if (currentChatId === chatId) {
      await startNewChat("Chat deleted. Starting new chat.");
    }

    loadRecentChats({ silent: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    alert("Failed to delete chat. Please try again.");
  }
}

async function loadRecentChats(options = {}) {
  if (isHistoryLoading) {
    return;
  }

  const silent = options.silent === true;
  const auth = window.LockInAuth;

  if (!auth || typeof auth.getValidAccessToken !== "function") {
    if (!silent) {
      historyStatusMessage = "Sign in via the popup to see your chats.";
      if (lockinWidget && lockinWidget.isOpen) {
        renderBubbleContent();
      }
    }
    return;
  }

  isHistoryLoading = true;
  if (!silent) {
    historyStatusMessage = "Loading chats...";
    if (lockinWidget && lockinWidget.isOpen) {
      renderBubbleContent();
    }
  }

  try {
    const token = await auth.getValidAccessToken();
    if (!token) {
      throw new Error("Sign in to view chats.");
    }
    const params = new URLSearchParams({ limit: String(RECENT_CHAT_LIMIT) });
    const response = await fetch(
      `${BACKEND_URL}/api/chats?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to load chats");
    }

    const data = await response.json();
    recentChats = Array.isArray(data) ? data : [];
    hasLoadedChats = true;
    if (!silent) {
      historyStatusMessage = recentChats.length
        ? ""
        : "Start a new chat to see it here.";
    }
  } catch (error) {
    console.error("Lock-in recent chats error:", error);
    if (!silent) {
      historyStatusMessage =
        error?.message || "Unable to load chats right now.";
    }
  } finally {
    isHistoryLoading = false;
    hasLoadedChats = true;
    if (lockinWidget && lockinWidget.isOpen) {
      renderBubbleContent();
    }
  }
}

async function fetchChatMessagesFromApi(chatId) {
  const auth = window.LockInAuth;
  if (!auth || typeof auth.getValidAccessToken !== "function") {
    throw new Error("Sign in to open chats.");
  }
  const token = await auth.getValidAccessToken();
  if (!token) {
    throw new Error("Sign in to open chats.");
  }

  const response = await fetch(`${BACKEND_URL}/api/chats/${chatId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to load chat messages");
  }

  return response.json();
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
  if (!chrome.runtime) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: "getTabId" });
    currentTabId = response.tabId;
    console.log("Lock-in: Tab ID:", currentTabId);
  } catch (error) {
    console.error("Lock-in: Failed to get tab ID:", error);
  }
}

/**
 * Load session for current tab
 */
async function loadSessionForCurrentTab() {
  if (!chrome.runtime || !currentTabId) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: "getSession" });
    const session = response.session;

    // No session exists
    if (!session || !session.isActive) return;

    // Check if origin matches
    if (session.origin !== currentOrigin) {
      console.log("Lock-in: Origin changed, not restoring session");
      await clearSessionForCurrentTab();
      return;
    }

    // Check if user explicitly closed it
    if (session.isClosed) {
      console.log("Lock-in: Session was closed by user");
      return;
    }

    console.log("Lock-in: Restoring session for tab", currentTabId);

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
    console.error("Lock-in: Failed to load session:", error);
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
  if (!chrome?.storage?.local) {
    currentChatId = null;
    return null;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([CHAT_ID_STORAGE_KEY], (data) => {
      currentChatId = data?.[CHAT_ID_STORAGE_KEY] || null;
      resolve(currentChatId);
    });
  });
}

function setStoredChatId(chatId) {
  if (!chrome?.storage?.local) {
    currentChatId = chatId || null;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if (!chatId) {
      chrome.storage.local.remove([CHAT_ID_STORAGE_KEY], () => resolve());
    } else {
      chrome.storage.local.set({ [CHAT_ID_STORAGE_KEY]: chatId }, () =>
        resolve()
      );
    }
  });
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

  try {
    await chrome.runtime.sendMessage({
      action: "saveSession",
      sessionData,
    });
  } catch (error) {
    console.error("Lock-in: Failed to save session:", error);
  }
}

/**
 * Update just the position/size in the current session
 */
async function updateSessionPosition() {
  if (!chrome.runtime || !currentTabId) return;

  try {
    // Get current session
    const response = await chrome.runtime.sendMessage({ action: "getSession" });
    const session = response.session;

    if (session) {
      await chrome.runtime.sendMessage({
        action: "saveSession",
        sessionData: session,
      });
    }
  } catch (error) {
    console.error("Lock-in: Failed to update session position:", error);
  }
}

/**
 * Clear session for current tab
 */
async function clearSessionForCurrentTab() {
  if (!chrome.runtime || !currentTabId) return;

  try {
    await chrome.runtime.sendMessage({ action: "clearSession" });
  } catch (error) {
    console.error("Lock-in: Failed to clear session:", error);
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
      console.log("TODO: Handle upgrade plan action");
      break;
    case "personalisation":
      isPersonalisationPanelOpen = !isPersonalisationPanelOpen;
      renderPersonalisationPanel();
      break;
    case "settings":
      console.log("TODO: Handle settings action");
      break;
    case "help":
      console.log("TODO: Handle help action");
      break;
    case "logout":
      handleLogout();
      break;
    default:
      console.log(`Unknown profile action: ${action}`);
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
    console.log("Logout handler not available");
  }
}

/**
 * Render personalisation panel
 */
function renderPersonalisationPanel() {
  // TODO: Implement personalisation panel UI
  console.log("Opening personalisation panel");
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
function setAsDefault(mode) {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  chrome.storage.sync.set(
    { defaultMode: mode, modePreference: "fixed" },
    () => {
      const btn =
        lockinWidget && lockinWidget.getBubbleElement()
          ? lockinWidget
              .getBubbleElement()
              .querySelector(".lockin-set-default")
          : null;
      if (!btn) return;

      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span style="font-size: 11px;">&check;</span>';
      btn.style.color = "#10b981";
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.color = "";
      }, 1500);
    }
  );
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
    console.warn("Lock-in: Chrome extension API not available");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInit);
} else {
  safeInit();
}
