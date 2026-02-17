/**
 * Chrome Storage Adapter
 *
 * Implements StorageInterface using Chrome's storage.sync API.
 * This is the bridge between the Chrome-agnostic core code and Chrome-specific storage.
 */

import type { StorageInterface } from '../../core/storage/storageInterface';

type NormalizedStorageChanges<T> = Record<string, { oldValue?: T; newValue?: T }>;

function getChromeRuntimeErrorMessage(): string | null {
  const runtimeErrorMessage = chrome.runtime.lastError?.message;
  if (typeof runtimeErrorMessage === 'string' && runtimeErrorMessage.length > 0) {
    return runtimeErrorMessage;
  }
  return null;
}

function normalizeStorageChanges<T>(changes: {
  [key: string]: chrome.storage.StorageChange;
}): NormalizedStorageChanges<T> {
  const normalizedChanges: NormalizedStorageChanges<T> = {};

  for (const [key, change] of Object.entries(changes)) {
    const normalizedChange: { oldValue?: T; newValue?: T } = {};
    if (change.oldValue !== undefined) {
      normalizedChange.oldValue = change.oldValue as unknown as T;
    }
    if (change.newValue !== undefined) {
      normalizedChange.newValue = change.newValue as unknown as T;
    }
    normalizedChanges[key] = normalizedChange;
  }

  return normalizedChanges;
}

/**
 * Chrome storage implementation of StorageInterface
 * Uses chrome.storage.sync for cross-device persistence
 */
export const chromeStorage: StorageInterface = {
  async get<T = unknown>(key: string | string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(key, (result) => {
          const errorMessage = getChromeRuntimeErrorMessage();
          if (errorMessage === null) {
            resolve(result as Record<string, T>);
            return;
          }
          reject(new Error(errorMessage));
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
          const errorMessage = getChromeRuntimeErrorMessage();
          if (errorMessage === null) {
            resolve();
            return;
          }
          reject(new Error(errorMessage));
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
          const errorMessage = getChromeRuntimeErrorMessage();
          if (errorMessage === null) {
            resolve();
            return;
          }
          reject(new Error(errorMessage));
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
    ): void => {
      const normalizedChanges = normalizeStorageChanges<T>(changes);
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
          const errorMessage = getChromeRuntimeErrorMessage();
          if (errorMessage === null) {
            resolve(result as Record<string, T>);
            return;
          }
          reject(new Error(errorMessage));
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
          const errorMessage = getChromeRuntimeErrorMessage();
          if (errorMessage === null) {
            resolve();
            return;
          }
          reject(new Error(errorMessage));
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
          const errorMessage = getChromeRuntimeErrorMessage();
          if (errorMessage === null) {
            resolve();
            return;
          }
          reject(new Error(errorMessage));
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
    ): void => {
      // Only fire for local storage changes
      if (areaName !== 'local') return;

      const normalizedChanges = normalizeStorageChanges<T>(changes);
      callback(normalizedChanges, areaName);
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  },
};
