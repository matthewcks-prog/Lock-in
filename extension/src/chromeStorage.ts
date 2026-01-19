/**
 * Chrome Storage Adapter
 *
 * Implements StorageInterface using Chrome's storage.sync API.
 * This is the bridge between the Chrome-agnostic core code and Chrome-specific storage.
 */

import type { StorageInterface } from '../../core/storage/storageInterface';

/**
 * Chrome storage implementation of StorageInterface
 * Uses chrome.storage.sync for cross-device persistence
 */
export const chromeStorage: StorageInterface = {
  async get<T = unknown>(key: string | string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(key, (result) => {
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

  async set<T = unknown>(data: Record<string, T>): Promise<void> {
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

  onChanged<T = unknown>(
    callback: (changes: Record<string, { oldValue?: T; newValue?: T }>, areaName: string) => void,
  ): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      // Convert Chrome's StorageChange format to our interface format
      const normalizedChanges: Record<string, { oldValue?: T; newValue?: T }> = {};
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

/**
 * Chrome local storage implementation
 * Uses chrome.storage.local for larger, device-specific data
 */
export const chromeLocalStorage: StorageInterface = {
  async get<T = unknown>(key: string | string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (result) => {
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

  async set<T = unknown>(data: Record<string, T>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(data, () => {
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

  onChanged<T = unknown>(
    callback: (changes: Record<string, { oldValue?: T; newValue?: T }>, areaName: string) => void,
  ): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      // Only fire for local storage changes
      if (areaName !== 'local') return;

      const normalizedChanges: Record<string, { oldValue?: T; newValue?: T }> = {};
      for (const key in changes) {
        normalizedChanges[key] = {
          oldValue: changes[key].oldValue,
          newValue: changes[key].newValue,
        };
      }
      callback(normalizedChanges, areaName);
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  },
};
