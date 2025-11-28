/**
 * Lock-in Background Service Worker
 * Handles context menu integration and extension-level coordination
 */

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

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Future: Handle authentication, token management, etc.

  if (message.action === "getSettings") {
    // Retrieve settings from storage
    chrome.storage.sync.get(
      ["preferredLanguage", "difficultyLevel"],
      (data) => {
        sendResponse(data);
      }
    );
    return true; // Keep message channel open for async response
  }

  if (message.action === "saveSettings") {
    // Save settings to storage
    chrome.storage.sync.set(message.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Log when service worker starts
console.log("Lock-in background service worker started");
