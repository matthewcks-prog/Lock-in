import { z } from 'zod';

/**
 * Chrome Storage Wrapper for Extension Content Scripts
 *
 * Provides storage abstraction with both sync and local storage support.
 * Exposes window.LockInStorage for use by content scripts.
 *
 * This is bundled by vite.config.contentLibs.ts into extension/dist/libs/
 */

/**
 * Storage keys used throughout the extension
 */
export const STORAGE_KEYS = {
  SIDEBAR_IS_OPEN: 'lockin_sidebar_isOpen',
  SIDEBAR_ACTIVE_TAB: 'lockin_sidebar_activeTab',
  CURRENT_CHAT_ID: 'lockinCurrentChatId',
  HIGHLIGHTING_ENABLED: 'highlightingEnabled',
  SELECTED_NOTE_ID: 'lockin_selectedNoteId',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const SIDEBAR_TAB_SCHEMA = z.enum(['chat', 'notes', 'tool']);
const NON_EMPTY_STRING_SCHEMA = z.string().min(1);
const NULLABLE_STRING_SCHEMA = z.string().min(1).nullable();
const BOOLEAN_SCHEMA = z.boolean();

const SYNC_SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  [STORAGE_KEYS.SIDEBAR_IS_OPEN]: BOOLEAN_SCHEMA,
  [STORAGE_KEYS.SIDEBAR_ACTIVE_TAB]: SIDEBAR_TAB_SCHEMA,
  [STORAGE_KEYS.HIGHLIGHTING_ENABLED]: BOOLEAN_SCHEMA,
  [STORAGE_KEYS.SELECTED_NOTE_ID]: NULLABLE_STRING_SCHEMA,
};

const LOCAL_SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  [STORAGE_KEYS.CURRENT_CHAT_ID]: NON_EMPTY_STRING_SCHEMA,
  [STORAGE_KEYS.SIDEBAR_IS_OPEN]: BOOLEAN_SCHEMA,
};

function sanitizeStorageValues(
  values: Record<string, unknown>,
  schemaMap: Record<string, z.ZodTypeAny>,
  areaLabel: string,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...values };
  Object.entries(values).forEach(([key, value]) => {
    const schema = schemaMap[key];
    if (!schema) return;
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      sanitized[key] = parsed.data;
      return;
    }
    delete sanitized[key];
    console.warn(`[LockInStorage] Invalid ${areaLabel} value for ${key}`, parsed.error.issues);
  });
  return sanitized;
}

function validateStorageWrite(
  data: Record<string, unknown>,
  schemaMap: Record<string, z.ZodTypeAny>,
  areaLabel: string,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const invalidKeys: string[] = [];
  Object.entries(data).forEach(([key, value]) => {
    const schema = schemaMap[key];
    if (!schema) {
      sanitized[key] = value;
      return;
    }
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      sanitized[key] = parsed.data;
    } else {
      invalidKeys.push(key);
    }
  });
  if (invalidKeys.length > 0) {
    throw new Error(`Invalid ${areaLabel} storage value(s): ${invalidKeys.join(', ')}`);
  }
  return sanitized;
}

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
  getLocal: <T = unknown>(keys: string | string[]) => Promise<Record<string, T>>;
  setLocal: (key: string, value: unknown) => Promise<void>;
  removeLocal: (keys: string | string[]) => Promise<void>;
  onChanged: (
    callback: (changes: Record<string, StorageChange>, areaName: string) => void,
  ) => () => void;
}

/**
 * Create storage wrapper using chrome.storage.sync
 * (sync storage syncs across user's Chrome instances)
 */
function createStorage(): Storage {
  return {
    STORAGE_KEYS,

    async get<T = unknown>(keys: string | string[]): Promise<Record<string, T>> {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              const sanitized = sanitizeStorageValues(result || {}, SYNC_SCHEMA_MAP, 'sync');
              resolve(sanitized as Record<string, T>);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    async set(data: Record<string, unknown>): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          const sanitized = validateStorageWrite(data, SYNC_SCHEMA_MAP, 'sync');
          chrome.storage.sync.set(sanitized, () => {
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

    async remove(keys: string | string[]): Promise<void> {
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

    async getLocal<T = unknown>(keys: string | string[]): Promise<Record<string, T>> {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              const sanitized = sanitizeStorageValues(result || {}, LOCAL_SCHEMA_MAP, 'local');
              resolve(sanitized as Record<string, T>);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    async setLocal(key: string, value: unknown): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          const sanitized = validateStorageWrite({ [key]: value }, LOCAL_SCHEMA_MAP, 'local');
          chrome.storage.local.set(sanitized, () => {
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

    async removeLocal(keys: string | string[]): Promise<void> {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.remove(keys, () => {
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
      callback: (changes: Record<string, StorageChange>, areaName: string) => void,
    ): () => void {
      const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string,
      ) => {
        // Convert Chrome's StorageChange format to our interface format
        const normalizedChanges: Record<string, StorageChange> = {};
        for (const key in changes) {
          const change = changes[key];
          if (!change) continue;
          normalizedChanges[key] = {
            oldValue: change.oldValue,
            newValue: change.newValue,
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
if (typeof window !== 'undefined') {
  window.LockInStorage = storage;
}

export { storage };
