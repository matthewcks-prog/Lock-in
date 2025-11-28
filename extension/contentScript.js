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
const BACKEND_URL = "http://localhost:3000";
const MIN_SELECTION_LENGTH = 3; // Minimum characters to trigger
const BUBBLE_OFFSET = 10; // Pixels offset from selection

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
const isMac = navigator.platform.toUpperCase().includes("MAC");

// ===================================
// Initialization
// ===================================
function init() {
  loadToggleState();
  listenToStorageChanges();
  setupEventListeners();
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

  chatHistory = [];
  pendingInputValue = "";
  isChatLoading = true;

  ensureChatBubble();
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: true });

  try {
    const settings = await getSettings();
    sessionPreferences = {
      preferredLanguage: settings.preferredLanguage || "en",
      difficultyLevel: settings.difficultyLevel || "highschool",
    };

    const data = await callLockInApi({
      selection: cachedSelection,
      mode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: [],
    });

    chatHistory = data.chatHistory || [];
    isChatLoading = false;
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    console.error("Lock-in error:", error);
    isChatLoading = false;

    if (cachedSelection) {
      chatHistory = buildFallbackHistory();
      chatHistory.push({
        role: "assistant",
        content:
          "I had trouble reaching Lock-in. Please check your connection and try again.",
      });
      renderChatBubble();
      saveSessionForCurrentTab();
    } else {
      showErrorBubble(
        "Something went wrong. Please check your connection or try again."
      );
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

  const response = await fetch(`${BACKEND_URL}/api/lockin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "API request failed");
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
    });

    chatHistory = data.chatHistory || [];
    isChatLoading = false;
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    console.error("Lock-in follow-up error:", error);
    isChatLoading = false;
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content:
          "I couldn't finish that request. Please try again in a moment.",
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

  activeBubble.innerHTML = getBubbleHTML(`
    <div class="lockin-bubble-header lockin-drag-handle" style="cursor: move;">
      <div class="lockin-header-left">
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
