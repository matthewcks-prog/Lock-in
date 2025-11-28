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
const isMac = navigator.platform.toUpperCase().includes("MAC");

// ===================================
// Initialization
// ===================================
function init() {
  loadToggleState();
  listenToStorageChanges();
  setupEventListeners();
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

    // Only remove bubble if user is requesting a new query (not just clicking around)
    // This allows the bubble to persist when clicking elsewhere on the page
    if (activeBubble) {
      // If bubble exists, only replace it with new query
      removeExistingBubble();
    }

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
    removeExistingBubble();
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

  // Show loading bubble
  showLoadingBubble();

  try {
    // Get settings
    const settings = await getSettings();

    // Call backend API (existing logic unchanged)
    const response = await fetch(`${BACKEND_URL}/api/lockin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cachedSelection,
        mode: mode,
        targetLanguage: settings.preferredLanguage || "en",
      }),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();
    showResponseBubble(data);
  } catch (error) {
    console.error("Lock-in error:", error);
    showErrorBubble(
      "Something went wrong. Please check your connection or try again."
    );
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

// ===================================
// Bubble Display Functions
// ===================================

/**
 * Show loading bubble
 */
function showLoadingBubble() {
  removeExistingBubble();

  activeBubble = document.createElement("div");
  activeBubble.className = "lockin-bubble";

  activeBubble.innerHTML = `
    <div class="lockin-bubble-header lockin-drag-handle" style="cursor: move;">
      <div class="lockin-header-left">
        <span class="lockin-mode-label">Loading...</span>
      </div>
    </div>
    <div class="lockin-bubble-content">
      <div class="lockin-spinner"></div>
      <p class="lockin-loading-text">Thinking...</p>
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

  requestAnimationFrame(() => {
    activeBubble.classList.add("lockin-visible");
  });
}

/**
 * Show response bubble with AI result
 */
function showResponseBubble(data) {
  removeExistingBubble();

  activeBubble = document.createElement("div");
  activeBubble.className = "lockin-bubble";

  // Get mode info
  const modeInfo = getModeInfo(data.mode);

  // Build response content (reusing existing logic)
  let bodyContent = buildResponseContent(data);

  activeBubble.innerHTML = `
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
        data.mode === "explain" ? "active" : ""
      }" data-mode="explain">
        <span>&#128161;</span> Explain
      </button>
      <button class="lockin-mode-btn ${
        data.mode === "simplify" ? "active" : ""
      }" data-mode="simplify">
        <span>&#9986;</span> Simplify
      </button>
      <button class="lockin-mode-btn ${
        data.mode === "translate" ? "active" : ""
      }" data-mode="translate">
        <span>&#127757;</span> Translate
      </button>
    </div>
    <div class="lockin-bubble-body">
      ${bodyContent}
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

  // Add event listeners
  activeBubble
    .querySelector(".lockin-close-bubble")
    .addEventListener("click", removeExistingBubble);

  activeBubble
    .querySelector(".lockin-set-default")
    .addEventListener("click", () => {
      setAsDefault(data.mode);
    });

  activeBubble.querySelectorAll(".lockin-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      runMode(btn.dataset.mode);
    });
  });

  requestAnimationFrame(() => {
    activeBubble.classList.add("lockin-visible");
  });
}

/**
 * Build response content based on mode (reusing existing logic)
 */
function buildResponseContent(data) {
  let bodyContent = "";

  if (data.mode === "explain") {
    bodyContent = `
      <div class="lockin-section">
        <p class="lockin-answer">${escapeHtml(data.answer)}</p>
      </div>
      ${
        data.example && data.example.trim()
          ? `
      <div class="lockin-section">
        <h4 class="lockin-section-title">Example</h4>
        <p class="lockin-example">${escapeHtml(data.example)}</p>
      </div>
      `
          : ""
      }
    `;
  } else if (data.mode === "simplify") {
    bodyContent = `
      <div class="lockin-section">
        <p class="lockin-answer">${escapeHtml(data.answer)}</p>
      </div>
    `;
  } else if (data.mode === "translate") {
    bodyContent = `
      <div class="lockin-section">
        <p class="lockin-answer">${escapeHtml(data.answer)}</p>
      </div>
      ${
        data.explanation
          ? `
      <div class="lockin-section">
        <h4 class="lockin-section-title">Explanation</h4>
        <p class="lockin-explanation">${escapeHtml(data.explanation)}</p>
      </div>
      `
          : ""
      }
    `;
  }

  return bodyContent;
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
    .addEventListener("click", removeExistingBubble);

  requestAnimationFrame(() => {
    activeBubble.classList.add("lockin-visible");
  });
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
    left = cachedRect.right + window.scrollX + BUBBLE_OFFSET;
    top = cachedRect.top + window.scrollY;
  }
  // Priority 2: Position to the left if there's enough space
  else if (spaceLeft >= bubbleWidth) {
    left = cachedRect.left + window.scrollX - bubbleWidth - BUBBLE_OFFSET;
    top = cachedRect.top + window.scrollY;
  }
  // Priority 3: Position above if there's space
  else if (spaceAbove >= 200) {
    left =
      cachedRect.left + window.scrollX + cachedRect.width / 2 - bubbleWidth / 2;
    top = cachedRect.top + window.scrollY - BUBBLE_OFFSET;
  }
  // Priority 4: Position below
  else {
    left =
      cachedRect.left + window.scrollX + cachedRect.width / 2 - bubbleWidth / 2;
    top = cachedRect.bottom + window.scrollY + BUBBLE_OFFSET;
  }

  // Clamp horizontally to stay in viewport
  const minLeft = padding;
  const maxLeft = viewportWidth - bubbleWidth - padding;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  bubble.style.position = "absolute";
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.style.width = `${bubbleWidth}px`;
  bubble.style.zIndex = "999999";
}

/**
 * Make bubble draggable by the header
 */
function makeDraggable(bubble) {
  const header = bubble.querySelector(".lockin-drag-handle");
  if (!header) return;

  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  header.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    // Don't drag if clicking on buttons
    if (e.target.closest("button")) return;

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === header || e.target.closest(".lockin-drag-handle")) {
      isDragging = true;
      bubble.style.transition = "none";
      e.preventDefault(); // Prevent text selection while dragging
      e.stopPropagation(); // Stop event from bubbling
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      // Get current position
      const rect = bubble.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(bubble);
      const currentLeft = parseInt(computedStyle.left) || rect.left;
      const currentTop = parseInt(computedStyle.top) || rect.top;

      // Apply new position
      bubble.style.left = `${
        currentLeft + currentX - (initialX - xOffset + currentX)
      }px`;
      bubble.style.top = `${
        currentTop + currentY - (initialY - yOffset + currentY)
      }px`;

      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
    }
  }

  function dragEnd() {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      bubble.style.transition = "";
    }
  }
}

/**
 * Remove existing bubble
 */
function removeExistingBubble() {
  if (activeBubble) {
    activeBubble.remove();
    activeBubble = null;
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
