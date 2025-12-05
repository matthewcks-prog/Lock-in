/**
 * Storage Wrapper for Lock-in Extension
 * 
 * Provides a clean async/await interface for chrome.storage operations
 * with error handling and default values.
 */

/**
 * Storage keys used throughout the extension
 */
const STORAGE_KEYS = {
  // UI state
  BUBBLE_OPEN: "lockinBubbleOpen",
  ACTIVE_MODE: "lockinActiveMode",
  THEME: "lockinTheme",
  ACCENT_COLOR: "lockinAccentColor",
  
  // Settings
  HIGHLIGHTING_ENABLED: "highlightingEnabled",
  PREFERRED_LANGUAGE: "preferredLanguage",
  DIFFICULTY_LEVEL: "difficultyLevel",
  DEFAULT_MODE: "defaultMode",
  MODE_PREFERENCE: "modePreference",
  LAST_USED_MODE: "lastUsedMode",
  
  // User data
  USER_PROFILE: "lockinUserProfile",
  
  // Sidebar
  SIDEBAR_IS_OPEN: "lockin_sidebar_isOpen",
  SIDEBAR_WIDTH: "lockin:sidebarWidth",
  
  // Chat
  CURRENT_CHAT_ID: "lockinCurrentChatId",
};

/**
 * Default values for settings
 */
const DEFAULTS = {
  [STORAGE_KEYS.HIGHLIGHTING_ENABLED]: true,
  [STORAGE_KEYS.ACTIVE_MODE]: "explain",
  [STORAGE_KEYS.THEME]: "light",
  [STORAGE_KEYS.ACCENT_COLOR]: "#667eea",
  [STORAGE_KEYS.PREFERRED_LANGUAGE]: "en",
  [STORAGE_KEYS.DIFFICULTY_LEVEL]: "highschool",
  [STORAGE_KEYS.DEFAULT_MODE]: "explain",
  [STORAGE_KEYS.MODE_PREFERENCE]: "fixed",
  [STORAGE_KEYS.SIDEBAR_IS_OPEN]: false,
  [STORAGE_KEYS.SIDEBAR_WIDTH]: 380,
};

/**
 * Check if chrome.storage is available
 * @returns {boolean}
 */
function isStorageAvailable() {
  return typeof chrome !== "undefined" && 
         chrome.storage && 
         (chrome.storage.sync || chrome.storage.local);
}

/**
 * Get a value from chrome.storage.sync
 * @param {string|string[]} keys - Key(s) to retrieve
 * @returns {Promise<*>}
 */
async function get(keys) {
  if (!isStorageAvailable()) {
    const singleKey = Array.isArray(keys) ? keys[0] : keys;
    return singleKey ? { [singleKey]: DEFAULTS[singleKey] } : {};
  }
  
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        // Apply defaults for missing keys
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const result = { ...data };
        keysArray.forEach((key) => {
          if (!(key in result) && key in DEFAULTS) {
            result[key] = DEFAULTS[key];
          }
        });
        
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get a single value from storage
 * @param {string} key - Key to retrieve
 * @param {*} [defaultValue] - Default value if key doesn't exist
 * @returns {Promise<*>}
 */
async function getValue(key, defaultValue = undefined) {
  const data = await get(key);
  return data[key] !== undefined ? data[key] : defaultValue;
}

/**
 * Set a value in chrome.storage.sync
 * @param {Object|string} keyOrData - Key to set, or object of key-value pairs
 * @param {*} [value] - Value to set (if first arg is a string)
 * @returns {Promise<void>}
 */
async function set(keyOrData, value = undefined) {
  if (!isStorageAvailable()) {
    return;
  }
  
  const data = typeof keyOrData === "string" 
    ? { [keyOrData]: value }
    : keyOrData;
  
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Remove a key from chrome.storage.sync
 * @param {string|string[]} keys - Key(s) to remove
 * @returns {Promise<void>}
 */
async function remove(keys) {
  if (!isStorageAvailable()) {
    return;
  }
  
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get a value from chrome.storage.local
 * @param {string|string[]} keys - Key(s) to retrieve
 * @returns {Promise<*>}
 */
async function getLocal(keys) {
  if (!isStorageAvailable() || !chrome.storage.local) {
    const singleKey = Array.isArray(keys) ? keys[0] : keys;
    return singleKey ? {} : {};
  }
  
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(data);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Set a value in chrome.storage.local
 * @param {Object|string} keyOrData - Key to set, or object of key-value pairs
 * @param {*} [value] - Value to set (if first arg is a string)
 * @returns {Promise<void>}
 */
async function setLocal(keyOrData, value = undefined) {
  if (!isStorageAvailable() || !chrome.storage.local) {
    return;
  }
  
  const data = typeof keyOrData === "string" 
    ? { [keyOrData]: value }
    : keyOrData;
  
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Remove a key from chrome.storage.local
 * @param {string|string[]} keys - Key(s) to remove
 * @returns {Promise<void>}
 */
async function removeLocal(keys) {
  if (!isStorageAvailable() || !chrome.storage.local) {
    return;
  }
  
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Listen for storage changes
 * @param {Function} callback - Callback function (changes, areaName) => void
 * @returns {Function} Unsubscribe function
 */
function onChanged(callback) {
  if (!isStorageAvailable()) {
    return () => {}; // No-op unsubscribe
  }
  
  chrome.storage.onChanged.addListener(callback);
  
  return () => {
    if (isStorageAvailable()) {
      chrome.storage.onChanged.removeListener(callback);
    }
  };
}

// Export for use in extension
if (typeof window !== "undefined") {
  window.LockInStorage = {
    STORAGE_KEYS,
    DEFAULTS,
    isStorageAvailable,
    get,
    getValue,
    set,
    remove,
    getLocal,
    setLocal,
    removeLocal,
    onChanged,
  };
}

// Export for Node.js/CommonJS if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    DEFAULTS,
    isStorageAvailable,
    get,
    getValue,
    set,
    remove,
    getLocal,
    setLocal,
    removeLocal,
    onChanged,
  };
}

