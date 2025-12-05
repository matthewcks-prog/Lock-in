/**
 * Messaging System for Lock-in Extension
 * 
 * Provides typed message communication between extension contexts (background, content, popup).
 * All messages follow a consistent structure with validation.
 */

/**
 * @typedef {Object} Message
 * @property {string} type - Message type identifier
 * @property {*} [payload] - Optional message payload
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} ok - Whether the operation succeeded
 * @property {*} [data] - Response data (if ok is true)
 * @property {string} [error] - Error message (if ok is false)
 */

// Message type constants
const MESSAGE_TYPES = {
  // Session management
  GET_TAB_ID: "GET_TAB_ID",
  GET_SESSION: "GET_SESSION",
  SAVE_SESSION: "SAVE_SESSION",
  CLEAR_SESSION: "CLEAR_SESSION",
  
  // Settings
  GET_SETTINGS: "GET_SETTINGS",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  
  // Sidebar control
  OPEN_SIDEBAR: "OPEN_SIDEBAR",
  CLOSE_SIDEBAR: "CLOSE_SIDEBAR",
  TOGGLE_SIDEBAR: "TOGGLE_SIDEBAR",
  
  // Context menu
  SHOW_MODE_SELECTOR: "SHOW_MODE_SELECTOR",
};

/**
 * Create a typed message
 * @param {string} type - Message type
 * @param {*} [payload] - Optional payload
 * @returns {Message}
 */
function createMessage(type, payload = null) {
  if (!type || typeof type !== "string") {
    throw new Error("Message type must be a non-empty string");
  }
  
  const message = { type };
  if (payload !== null && payload !== undefined) {
    message.payload = payload;
  }
  return message;
}

/**
 * Validate a message structure
 * @param {*} message - Message to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateMessage(message) {
  if (!message || typeof message !== "object") {
    return { valid: false, error: "Message must be an object" };
  }
  
  if (!message.type || typeof message.type !== "string") {
    return { valid: false, error: "Message must have a string 'type' property" };
  }
  
  // Check if type is known
  const knownTypes = Object.values(MESSAGE_TYPES);
  if (!knownTypes.includes(message.type)) {
    return { valid: false, error: `Unknown message type: ${message.type}` };
  }
  
  return { valid: true };
}

/**
 * Create a success response
 * @param {*} [data] - Response data
 * @returns {MessageResponse}
 */
function createSuccessResponse(data = null) {
  return { ok: true, data };
}

/**
 * Create an error response
 * @param {string} error - Error message
 * @returns {MessageResponse}
 */
function createErrorResponse(error) {
  if (!error || typeof error !== "string") {
    error = "Unknown error";
  }
  return { ok: false, error };
}

/**
 * Send a message and wait for response
 * @param {Message} message - Message to send
 * @returns {Promise<MessageResponse>}
 */
function sendMessage(message) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      resolve(createErrorResponse("Chrome runtime not available"));
      return;
    }
    
    const validation = validateMessage(message);
    if (!validation.valid) {
      resolve(createErrorResponse(validation.error));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(createErrorResponse(chrome.runtime.lastError.message));
          return;
        }
        
        // Ensure response follows MessageResponse structure
        if (response && typeof response === "object") {
          if (response.ok === true || response.ok === false) {
            resolve(response);
          } else {
            // Legacy response format - wrap it
            resolve(createSuccessResponse(response));
          }
        } else {
          resolve(createSuccessResponse(response));
        }
      });
    } catch (error) {
      resolve(createErrorResponse(error.message || String(error)));
    }
  });
}

/**
 * Set up a message listener with typed handling
 * @param {Function} handler - Handler function that receives (message, sender) and returns Promise<MessageResponse>
 */
function setupMessageListener(handler) {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    return;
  }
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate message
    const validation = validateMessage(message);
    if (!validation.valid) {
      sendResponse(createErrorResponse(validation.error));
      return true; // Keep channel open for async
    }
    
    // Call handler
    Promise.resolve(handler(message, sender))
      .then((response) => {
        // Ensure response is properly formatted
        if (response && typeof response === "object" && (response.ok === true || response.ok === false)) {
          sendResponse(response);
        } else {
          sendResponse(createSuccessResponse(response));
        }
      })
      .catch((error) => {
        sendResponse(createErrorResponse(error.message || String(error)));
      });
    
    return true; // Keep channel open for async
  });
}

// Export for use in extension (works in both window and service worker contexts)
const globalScope = typeof window !== "undefined" 
  ? window 
  : typeof self !== "undefined" 
    ? self 
    : typeof global !== "undefined" 
      ? global 
      : {};

if (globalScope) {
  globalScope.LockInMessaging = {
    MESSAGE_TYPES,
    createMessage,
    validateMessage,
    createSuccessResponse,
    createErrorResponse,
    sendMessage,
    setupMessageListener,
  };
}

// Export for Node.js/CommonJS if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MESSAGE_TYPES,
    createMessage,
    validateMessage,
    createSuccessResponse,
    createErrorResponse,
    sendMessage,
    setupMessageListener,
  };
}

