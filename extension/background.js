/**
 * Lock-in Background Service Worker
 * 
 * Handles context menu integration, per-tab session management, and extension-level coordination.
 * Uses the messaging system for typed communication.
 */

// Import messaging system (available via global in service worker)
const Messaging = typeof self !== "undefined" && self.LockInMessaging 
  ? self.LockInMessaging 
  : null;

// Session management
const SESSION_STORAGE_PREFIX = "lockin_session_";

/**
 * Get session key for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {string}
 */
function getSessionKey(tabId) {
  return `${SESSION_STORAGE_PREFIX}${tabId}`;
}

/**
 * Get session for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object|null>}
 */
async function getSession(tabId) {
  if (!tabId) return null;
  
  const key = getSessionKey(tabId);
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  } catch (error) {
    console.error("Lock-in: Failed to get session:", error);
    return null;
  }
}

/**
 * Save session for a specific tab
 * @param {number} tabId - Tab ID
 * @param {Object} sessionData - Session data
 * @returns {Promise<void>}
 */
async function saveSession(tabId, sessionData) {
  if (!tabId) return;
  
  const key = getSessionKey(tabId);
  const storedSession = {
    ...(sessionData || {}),
    chatHistory: Array.isArray(sessionData?.chatHistory)
      ? sessionData.chatHistory
      : [],
    updatedAt: Date.now(),
  };
  
  try {
    await chrome.storage.local.set({ [key]: storedSession });
  } catch (error) {
    console.error("Lock-in: Failed to save session:", error);
  }
}

/**
 * Clear session for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
async function clearSession(tabId) {
  if (!tabId) return;
  
  const key = getSessionKey(tabId);
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error("Lock-in: Failed to clear session:", error);
  }
}

/**
 * Handle message from content script or popup
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender info
 * @returns {Promise<Object>}
 */
async function handleMessage(message, sender) {
  const tabId = sender.tab?.id;
  
  // Use messaging system if available, otherwise fall back to legacy format
  const messageType = message.type || message.action;
  
  try {
    switch (messageType) {
      case "getTabId":
      case "GET_TAB_ID": {
        return Messaging 
          ? Messaging.createSuccessResponse({ tabId })
          : { tabId };
      }
      
      case "getSession":
      case "GET_SESSION": {
        const session = await getSession(tabId);
        return Messaging
          ? Messaging.createSuccessResponse({ session })
          : { session };
      }
      
      case "saveSession":
      case "SAVE_SESSION": {
        const sessionData = message.sessionData || message.payload?.sessionData;
        await saveSession(tabId, sessionData);
        return Messaging
          ? Messaging.createSuccessResponse({ success: true })
          : { success: true };
      }
      
      case "clearSession":
      case "CLEAR_SESSION": {
        await clearSession(tabId);
        return Messaging
          ? Messaging.createSuccessResponse({ success: true })
          : { success: true };
      }
      
      case "getSettings":
      case "GET_SETTINGS": {
        return new Promise((resolve) => {
          chrome.storage.sync.get(
            ["preferredLanguage", "difficultyLevel"],
            (data) => {
              resolve(Messaging
                ? Messaging.createSuccessResponse(data)
                : data
              );
            }
          );
        });
      }
      
      case "saveSettings":
      case "UPDATE_SETTINGS": {
        const settings = message.settings || message.payload?.settings || {};
        return new Promise((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve(Messaging
              ? Messaging.createSuccessResponse({ success: true })
              : { success: true }
            );
          });
        });
      }
      
      default: {
        const error = `Unknown message type: ${messageType}`;
        return Messaging
          ? Messaging.createErrorResponse(error)
          : { error };
      }
    }
  } catch (error) {
    console.error("Lock-in: Error handling message:", error);
    const errorMessage = error.message || String(error);
    return Messaging
      ? Messaging.createErrorResponse(errorMessage)
      : { error: errorMessage };
  }
}

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "lockin-process",
    title: "Lock-in: Explain",
    contexts: ["selection"],
  });
  
  console.log("Lock-in extension installed successfully!");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lockin-process" && info.selectionText) {
    // Send message to content script to show the mode selector
    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_MODE_SELECTOR",
      payload: {
        text: info.selectionText,
      },
    }).catch((error) => {
      console.error("Lock-in: Failed to send message to content script:", error);
    });
  }
});

// Clean up session when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await clearSession(tabId);
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

// Set up message listener
if (Messaging && typeof Messaging.setupMessageListener === "function") {
  Messaging.setupMessageListener(handleMessage);
} else {
  // Fallback to legacy message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse({ error: error.message || String(error) });
      });
    return true; // Keep channel open for async
  });
}

// Log when service worker starts
console.log("Lock-in background service worker started");
