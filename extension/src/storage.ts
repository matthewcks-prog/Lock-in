/**
 * Chrome Storage Wrapper for Extension Content Scripts
 * 
 * Provides storage abstraction with both sync and local storage support.
 * Exposes window.LockInStorage for use by content scripts.
 * 
 * This is bundled by vite.config.contentLibs.ts into extension/libs/
 */

/**
 * Storage keys used throughout the extension
 */
export const STORAGE_KEYS = {
  SIDEBAR_IS_OPEN: "lockin_sidebar_isOpen",
  SIDEBAR_ACTIVE_TAB: "lockin_sidebar_activeTab",
  CURRENT_CHAT_ID: "lockinCurrentChatId",
  ACTIVE_MODE: "lockinActiveMode",
  MODE_PREFERENCE: "modePreference",
  DEFAULT_MODE: "defaultMode",
  LAST_USED_MODE: "lastUsedMode",
  HIGHLIGHTING_ENABLED: "highlightingEnabled",
  SELECTED_NOTE_ID: "lockin_selectedNoteId",
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Storage change event
 */
export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Storage interface
 */
export interface Storage {
  STORAGE_KEYS: typeof STORAGE_KEYS;
  get: <T = unknown>(keys: string | string[]) => Promise<Record<string, T>>;
  set: (data: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  onChanged: (
    callback: (changes: Record<string, StorageChange>, areaName: string) => void
  ) => () => void;
}

/**
 * Create storage wrapper using chrome.storage.sync
 * (sync storage syncs across user's Chrome instances)
 */
function createStorage(): Storage {
  return {
    STORAGE_KEYS,

    get<T = unknown>(keys: string | string[]): Promise<Record<string, T>> {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result as Record<string, T>);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    set(data: Record<string, unknown>): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    remove(keys: string | string[]): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.remove(keys, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    onChanged(
      callback: (changes: Record<string, StorageChange>, areaName: string) => void
    ): () => void {
      const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        // Convert Chrome's StorageChange format to our interface format
        const normalizedChanges: Record<string, StorageChange> = {};
        for (const key in changes) {
          normalizedChanges[key] = {
            oldValue: changes[key].oldValue,
            newValue: changes[key].newValue,
          };
        }
        callback(normalizedChanges, areaName);
      };

      chrome.storage.onChanged.addListener(listener);

      // Return unsubscribe function
      return () => {
        chrome.storage.onChanged.removeListener(listener);
      };
    },
  };
}

// Create and expose storage
const storage = createStorage();

// Expose globally for content scripts
if (typeof window !== "undefined") {
  (window as any).LockInStorage = storage;
}

export { storage };
