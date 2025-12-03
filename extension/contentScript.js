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
// State Management
// ===================================
let highlightingEnabled = true; // Toggle state from popup
let currentMode = "explain"; // Current active mode
let cachedSelection = ""; // Selected text
let cachedRect = null; // Selection bounding box
let activeBubble = null; // Current bubble element
let isDraggingBubble = false; // Flag to track dragging state
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

// ===================================
// Initialization
// ===================================
function init() {
  loadToggleState();
  listenToStorageChanges();
  setupEventListeners();
  loadStoredChatId();
  listenToAuthChanges();
  // Get tab ID and restore session if available
  getTabId().then(() => {
    setTimeout(loadSessionForCurrentTab, 500); // Small delay to ensure page is ready
  });
}

/**
 * Load highlighting enabled state from storage
 */
function loadToggleState() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  chrome.storage.sync.get(["highlightingEnabled"], (data) => {
    highlightingEnabled = data.highlightingEnabled !== false; // Default to true
  });
}

/**
 * Listen for storage changes (when user toggles in popup)
 */
function listenToStorageChanges() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.highlightingEnabled) {
      highlightingEnabled = changes.highlightingEnabled.newValue;
      if (!highlightingEnabled) {
        removeExistingBubble();
      }
    }

    if (areaName === "local" && changes[CHAT_ID_STORAGE_KEY]) {
      currentChatId = changes[CHAT_ID_STORAGE_KEY].newValue || null;
      historyStatusMessage = "";
      if (!currentChatId) {
        chatHistory = [];
      }
      if (activeBubble) {
        renderChatBubble();
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
  if (isDraggingBubble) {
    return;
  }

  // Ignore clicks inside the bubble
  if (activeBubble && activeBubble.contains(event.target)) {
    return;
  }

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
      currentMode = "explain";
      resolve();
      return;
    }

    try {
      chrome.storage.sync.get(
        ["modePreference", "defaultMode", "lastUsedMode"],
        (data) => {
          if (chrome.runtime.lastError) {
            console.log(
              "Lock-in: Mode preference error:",
              chrome.runtime.lastError
            );
            currentMode = "explain";
            resolve();
            return;
          }

          const modePref = data.modePreference || "fixed";

          if (modePref === "lastUsed" && data.lastUsedMode) {
            currentMode = data.lastUsedMode;
          } else {
            currentMode = data.defaultMode || "explain";
          }

          resolve();
        }
      );
    } catch (error) {
      console.log("Lock-in: Mode determination error:", error);
      currentMode = "explain";
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
  const selectionMessage = cachedSelection
    ? `Original text:\n${cachedSelection}`
    : "";
  const optimisticHistory = selectionMessage
    ? [...baseHistory, { role: "user", content: selectionMessage }]
    : baseHistory;

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
      newUserMessage:
        currentChatId && selectionMessage ? selectionMessage : undefined,
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
      showErrorBubble(getAssistantErrorMessage(error));
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
// Bubble Display Functions
// ===================================

function ensureChatBubble() {
  if (activeBubble) {
    return;
  }

  activeBubble = document.createElement("div");
  activeBubble.className = "lockin-bubble";
  positionBubble(activeBubble);
  document.body.appendChild(activeBubble);

  activeBubble.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  activeBubble.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  requestAnimationFrame(() => {
    activeBubble.classList.add("lockin-visible");
  });
}

function renderChatBubble() {
  if (!activeBubble) {
    ensureChatBubble();
  }

  const modeInfo = getModeInfo(currentMode);
  const chatHtml = buildChatMessagesHtml(chatHistory);
  const sendDisabled = isChatLoading || pendingInputValue.trim().length === 0;
  const layoutClass = isHistoryPanelOpen
    ? "lockin-history-open"
    : "lockin-history-collapsed";

  if (!hasLoadedChats && !isHistoryLoading) {
    loadRecentChats({ silent: true });
  }

  activeBubble.innerHTML = getBubbleHTML(`
    <div class="lockin-bubble-layout ${layoutClass}">
      ${buildHistoryPanelHtml()}
      <div class="lockin-chat-panel">
        <div class="lockin-bubble-header lockin-drag-handle" style="cursor: move;">
          <div class="lockin-header-left">
            <button class="lockin-history-toggle" title="Toggle chat history">
              ${isHistoryPanelOpen ? "&lt;" : "&gt;"}
            </button>
            <span class="lockin-mode-icon">${modeInfo.icon}</span>
            <span class="lockin-mode-label">${modeInfo.label}</span>
          </div>
          <div class="lockin-header-right">
            <button class="lockin-set-default" title="Set as default mode">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="lockin-close-bubble">&times;</button>
          </div>
        </div>
        <div class="lockin-bubble-modes">
          <button class="lockin-mode-btn ${
            currentMode === "explain" ? "active" : ""
          }" data-mode="explain" ${isChatLoading ? "disabled" : ""}>
            <span>&#128161;</span> Explain
          </button>
          <button class="lockin-mode-btn ${
            currentMode === "simplify" ? "active" : ""
          }" data-mode="simplify" ${isChatLoading ? "disabled" : ""}>
            <span>&#9986;</span> Simplify
          </button>
          <button class="lockin-mode-btn ${
            currentMode === "translate" ? "active" : ""
          }" data-mode="translate" ${isChatLoading ? "disabled" : ""}>
            <span>&#127757;</span> Translate
          </button>
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
  `);

  makeDraggable(activeBubble);
  makeResizable(activeBubble);

  const closeButton = activeBubble.querySelector(".lockin-close-bubble");
  if (closeButton) {
    closeButton.addEventListener("click", closeBubble);
  }

  const defaultButton = activeBubble.querySelector(".lockin-set-default");
  if (defaultButton) {
    defaultButton.addEventListener("click", () => setAsDefault(currentMode));
  }

  activeBubble.querySelectorAll(".lockin-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) {
        return;
      }

      if (btn.dataset.mode && btn.dataset.mode !== currentMode) {
        runMode(btn.dataset.mode);
      }
    });
  });

  const textarea = activeBubble.querySelector(".lockin-chat-textarea");
  if (textarea) {
    textarea.value = pendingInputValue;
    textarea.addEventListener("input", (event) => {
      pendingInputValue = event.target.value;
      const sendButton = activeBubble.querySelector(".lockin-send-btn");
      if (sendButton) {
        sendButton.disabled =
          isChatLoading || event.target.value.trim().length === 0;
      }
    });
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleFollowUpSubmit();
      }
    });

    if (!pendingInputValue) {
      textarea.focus();
    }
  }

  const sendButton = activeBubble.querySelector(".lockin-send-btn");
  if (sendButton) {
    sendButton.addEventListener("click", handleFollowUpSubmit);
  }

  const historyToggle = activeBubble.querySelector(".lockin-history-toggle");
  if (historyToggle) {
    historyToggle.addEventListener("click", () => {
      isHistoryPanelOpen = !isHistoryPanelOpen;
      if (isHistoryPanelOpen) {
        loadRecentChats({ silent: false });
      }
      renderChatBubble();
    });
  }

  const newChatBtn = activeBubble.querySelector(".lockin-new-chat-btn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      handleNewChatRequest();
    });
  }

  activeBubble.querySelectorAll(".lockin-history-item").forEach((item) => {
    item.addEventListener("click", () => {
      const chatId = item.getAttribute("data-chat-id");
      if (!chatId || chatId === currentChatId) {
        return;
      }
      handleHistorySelection(chatId);
    });
  });

  scrollChatToBottom();
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
            <button class="lockin-history-item ${
              isActive ? "active" : ""
            }" data-chat-id="${chat.id}">
              <span class="lockin-history-title">${escapeHtml(
                chat.title || buildFallbackHistoryTitle(chat)
              )}</span>
              <span class="lockin-history-meta">${escapeHtml(
                formatHistoryTimestamp(chat.last_message_at || chat.created_at)
              )}</span>
            </button>
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
    </aside>
  `;
}

function buildFallbackHistoryTitle(chat) {
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

async function loadRecentChats(options = {}) {
  if (isHistoryLoading) {
    return;
  }

  const silent = options.silent === true;
  const auth = window.LockInAuth;

  if (!auth || typeof auth.getValidAccessToken !== "function") {
    if (!silent) {
      historyStatusMessage = "Sign in via the popup to see your chats.";
      if (activeBubble) {
        renderChatBubble();
      }
    }
    return;
  }

  isHistoryLoading = true;
  if (!silent) {
    historyStatusMessage = "Loading chats...";
    if (activeBubble) {
      renderChatBubble();
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
    if (activeBubble) {
      renderChatBubble();
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
  if (!activeBubble) {
    return;
  }

  requestAnimationFrame(() => {
    const messagesEl = activeBubble.querySelector(".lockin-chat-messages");
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
}

function getBubbleHTML(content) {
  return `
    <div class="lockin-resize-handle lockin-resize-n" data-direction="n"></div>
    <div class="lockin-resize-handle lockin-resize-s" data-direction="s"></div>
    <div class="lockin-resize-handle lockin-resize-e" data-direction="e"></div>
    <div class="lockin-resize-handle lockin-resize-w" data-direction="w"></div>
    <div class="lockin-resize-handle lockin-resize-ne" data-direction="ne"></div>
    <div class="lockin-resize-handle lockin-resize-nw" data-direction="nw"></div>
    <div class="lockin-resize-handle lockin-resize-se" data-direction="se"></div>
    <div class="lockin-resize-handle lockin-resize-sw" data-direction="sw"></div>
    ${content}
  `;
}

/**
 * Show error bubble
 */
function showErrorBubble(message) {
  removeExistingBubble();

  activeBubble = document.createElement("div");
  activeBubble.className = "lockin-bubble lockin-error";

  activeBubble.innerHTML = `
    <div class="lockin-bubble-header lockin-drag-handle" style="cursor: move;">
      <div class="lockin-header-left">
        <span class="lockin-mode-label">Error</span>
      </div>
      <div class="lockin-header-right">
        <button class="lockin-close-bubble">&times;</button>
      </div>
    </div>
    <div class="lockin-bubble-body">
      <p class="lockin-error-message">${escapeHtml(message)}</p>
    </div>
  `;

  positionBubble(activeBubble);
  document.body.appendChild(activeBubble);
  makeDraggable(activeBubble);

  // Prevent bubble from closing when clicking inside it
  activeBubble.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  activeBubble.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  activeBubble
    .querySelector(".lockin-close-bubble")
    .addEventListener("click", closeBubble);

  requestAnimationFrame(() => {
    activeBubble.classList.add("lockin-visible");
  });
}

function removeExistingBubble() {
  if (activeBubble) {
    activeBubble.remove();
    activeBubble = null;
  }
}

// ===================================
// Bubble Positioning & Dragging
// ===================================

/**
 * Position bubble near the selected text
 * Prioritizes positioning that doesn't block nearby content
 */
function positionBubble(bubble) {
  if (!cachedRect) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const bubbleWidth = 360;
  const padding = 20;

  let left, top;

  // Calculate space available on each side
  const spaceRight = viewportWidth - (cachedRect.right + padding);
  const spaceLeft = cachedRect.left - padding;
  const spaceAbove = cachedRect.top - padding;
  const spaceBelow = viewportHeight - cachedRect.bottom - padding;

  // Priority 1: Position to the right if there's enough space
  if (spaceRight >= bubbleWidth) {
    left = cachedRect.right + BUBBLE_OFFSET;
    top = cachedRect.top;
  }
  // Priority 2: Position to the left if there's enough space
  else if (spaceLeft >= bubbleWidth) {
    left = cachedRect.left - bubbleWidth - BUBBLE_OFFSET;
    top = cachedRect.top;
  }
  // Priority 3: Position above if there's space
  else if (spaceAbove >= 200) {
    left = cachedRect.left + cachedRect.width / 2 - bubbleWidth / 2;
    top = cachedRect.top - BUBBLE_OFFSET;
  }
  // Priority 4: Position below
  else {
    left = cachedRect.left + cachedRect.width / 2 - bubbleWidth / 2;
    top = cachedRect.bottom + BUBBLE_OFFSET;
  }

  // Clamp horizontally to stay in viewport
  const minLeft = padding;
  const maxLeft = viewportWidth - bubbleWidth - padding;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  bubble.style.position = "fixed";
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  // Set initial width, but allow resizing
  if (!bubble.style.width) {
    bubble.style.width = `${bubbleWidth}px`;
  }
  bubble.style.zIndex = "999999";
}

/**
 * Make bubble draggable by the header
 */
function makeDraggable(bubble) {
  const header = bubble.querySelector(".lockin-drag-handle");
  if (!header) return;

  let isDragging = false;
  let startX;
  let startY;
  let startLeft;
  let startTop;

  header.addEventListener("mousedown", dragStart);

  function dragStart(e) {
    // Don't drag if clicking on buttons
    if (e.target.closest("button")) return;

    isDragging = true;
    isDraggingBubble = true;
    startX = e.clientX;
    startY = e.clientY;

    const computedStyle = window.getComputedStyle(bubble);
    startLeft = parseInt(computedStyle.left, 10);
    startTop = parseInt(computedStyle.top, 10);

    // Fallback if parseInt returns NaN (e.g. if left is "auto")
    if (isNaN(startLeft)) {
      const rect = bubble.getBoundingClientRect();
      startLeft = rect.left;
    }
    if (isNaN(startTop)) {
      const rect = bubble.getBoundingClientRect();
      startTop = rect.top;
    }

    bubble.style.transition = "none";

    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;

    e.preventDefault();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    bubble.style.left = `${startLeft + dx}px`;
    bubble.style.top = `${startTop + dy}px`;
  }

  function dragEnd() {
    isDragging = false;
    // Reset flag after a short delay to ensure handleMouseUp sees it as true
    setTimeout(() => {
      isDraggingBubble = false;
    }, 50);

    bubble.style.transition = "";
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", dragEnd);

    // Save new position
    updateSessionPosition();
  }
}

/**
 * Make bubble resizable from all sides
 */
function makeResizable(bubble) {
  const handles = bubble.querySelectorAll(".lockin-resize-handle");
  let isResizing = false;
  let currentHandle = null;
  let startX, startY, startWidth, startHeight, startLeft, startTop;

  handles.forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent dragging
      isResizing = true;
      isDraggingBubble = true; // Reuse this flag to prevent other interactions
      currentHandle = handle.dataset.direction;
      startX = e.clientX;
      startY = e.clientY;

      const rect = bubble.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;

      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", stopResize);
    });
  });

  function resize(e) {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (currentHandle.includes("e")) {
      bubble.style.width = `${Math.max(300, startWidth + dx)}px`;
    }
    if (currentHandle.includes("s")) {
      bubble.style.height = `${Math.max(150, startHeight + dy)}px`;
    }
    if (currentHandle.includes("w")) {
      const newWidth = Math.max(300, startWidth - dx);
      bubble.style.width = `${newWidth}px`;
      // Only update left if width actually changed (wasn't clamped)
      if (newWidth !== 300 || startWidth - dx > 300) {
        bubble.style.left = `${startLeft + dx}px`;
      }
    }
    if (currentHandle.includes("n")) {
      const newHeight = Math.max(150, startHeight - dy);
      bubble.style.height = `${newHeight}px`;
      // Only update top if height actually changed
      if (newHeight !== 150 || startHeight - dy > 150) {
        bubble.style.top = `${startTop + dy}px`;
      }
    }
  }

  function stopResize() {
    isResizing = false;
    setTimeout(() => {
      isDraggingBubble = false;
    }, 50);
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);

    // Save new size/position
    updateSessionPosition();
  }
}

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

      if (activeBubble && session.position) {
        activeBubble.style.left = session.position.left;
        activeBubble.style.top = session.position.top;
        activeBubble.style.width = session.position.width;
        activeBubble.style.height = session.position.height;
      }
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
    if (activeBubble) {
      renderChatBubble();
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
  if (!chrome.runtime || !currentTabId || !activeBubble) return;

  const computedStyle = window.getComputedStyle(activeBubble);
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
    position: {
      left: computedStyle.left,
      top: computedStyle.top,
      width: computedStyle.width,
      height: computedStyle.height,
    },
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
  if (!chrome.runtime || !currentTabId || !activeBubble) return;

  try {
    // Get current session
    const response = await chrome.runtime.sendMessage({ action: "getSession" });
    const session = response.session;

    if (session) {
      const computedStyle = window.getComputedStyle(activeBubble);
      session.position = {
        left: computedStyle.left,
        top: computedStyle.top,
        width: computedStyle.width,
        height: computedStyle.height,
      };

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
  if (activeBubble) {
    await saveSessionForCurrentTab({ isLoadingOverride: false });
    activeBubble.remove();
    activeBubble = null;
  }

  // Mark session as closed (user explicitly closed it)
  if (chrome.runtime && currentTabId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSession",
      });
      const session = response.session || {};
      session.tabId = currentTabId;
      session.origin = currentOrigin;
      session.selection = cachedSelection;
      session.mode = currentMode;
      session.chatHistory = chatHistory;
      session.chatId = currentChatId;
      session.targetLanguage = sessionPreferences.preferredLanguage;
      session.difficultyLevel = sessionPreferences.difficultyLevel;
      if (!session.position && activeBubble) {
        const computedStyle = window.getComputedStyle(activeBubble);
        session.position = {
          left: computedStyle.left,
          top: computedStyle.top,
          width: computedStyle.width,
          height: computedStyle.height,
        };
      }
      session.isClosed = true;
      session.isActive = false;

      await chrome.runtime.sendMessage({
        action: "saveSession",
        sessionData: session,
      });
    } catch (error) {
      console.error("Lock-in: Failed to mark session as closed:", error);
    }
  }
}

// ===================================
// Utility Functions
// ===================================

/**
 * Get mode info (icon and label)
 */
function getModeInfo(mode) {
  const modeMap = {
    explain: { icon: "&#128161;", label: "Explain" },
    simplify: { icon: "&#9986;", label: "Simplify" },
    translate: { icon: "&#127757;", label: "Translate" },
  };
  return modeMap[mode] || modeMap["explain"];
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
      const btn = activeBubble.querySelector(".lockin-set-default");
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
