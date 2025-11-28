/**
 * Lock-in Background Service Worker
 * Handles context menu integration, per-tab session management, and extension-level coordination
 */

// ===================================
// Session Management
// ===================================

/**
 * Get session key for a specific tab
 */
function getSessionKey(tabId) {
  return `lockin_session_${tabId}`;
}

/**
 * Get session for a specific tab
 */
async function getSession(tabId) {
  const key = getSessionKey(tabId);
  const result = await chrome.storage.local.get([key]);
  return result[key] || null;
}

/**
 * Save session for a specific tab
 */
async function saveSession(tabId, sessionData) {
  const key = getSessionKey(tabId);
  const storedSession = {
    ...(sessionData || {}),
    chatHistory: Array.isArray(sessionData?.chatHistory)
      ? sessionData.chatHistory
      : [],
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [key]: storedSession });
}

/**
 * Clear session for a specific tab
 */
async function clearSession(tabId) {
  const key = getSessionKey(tabId);
  await chrome.storage.local.remove(key);
}

// ===================================
// Extension Lifecycle
// ===================================

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lockin-process",
    title: "Lock-in: Explain/Simplify/Translate",
    contexts: ["selection"],
  });

  console.log("Lock-in extension installed successfully!");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lockin-process" && info.selectionText) {
    // Send message to content script to show the mode selector bubble
    chrome.tabs.sendMessage(tab.id, {
      action: "showModeSelector",
      text: info.selectionText,
    });
  }
});

// Clean up session when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearSession(tabId);
  console.log(`Lock-in: Cleared session for closed tab ${tabId}`);
});

// Detect navigation to different origin and clear session
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only handle main frame navigation (not iframes)
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const newOrigin = new URL(details.url).origin;

  // Get existing session
  const session = await getSession(tabId);

  if (session && session.origin !== newOrigin) {
    // Origin changed, clear the session
    await clearSession(tabId);
    console.log(`Lock-in: Origin changed in tab ${tabId}, cleared session`);
  }
});

// ===================================
// Message Handling
// ===================================

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Get tab ID from sender
  const tabId = sender.tab?.id;

  // Handle session management requests
  if (message.action === "getTabId") {
    sendResponse({ tabId: tabId });
    return true;
  }

  if (message.action === "getSession") {
    getSession(tabId).then((session) => {
      sendResponse({ session });
    });
    return true;
  }

  if (message.action === "saveSession") {
    saveSession(tabId, message.sessionData).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === "clearSession") {
    clearSession(tabId).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Handle settings requests (unchanged)
  if (message.action === "getSettings") {
    chrome.storage.sync.get(
      ["preferredLanguage", "difficultyLevel"],
      (data) => {
        sendResponse(data);
      }
    );
    return true;
  }

  if (message.action === "saveSettings") {
    chrome.storage.sync.set(message.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Log when service worker starts
console.log("Lock-in background service worker started");
