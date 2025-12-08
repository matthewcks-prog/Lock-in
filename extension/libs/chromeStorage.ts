/**
 * Chrome Storage Implementation
 * 
 * Implements StorageInterface using chrome.storage APIs.
 * This is the extension-specific implementation.
 */

import type { StorageInterface, LocalStorageInterface } from "../../core/storage/storageInterface";

/**
 * Chrome storage implementation for sync storage
 */
export class ChromeStorage implements StorageInterface {
  async get<T = any>(key: string | string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(key, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(data as Record<string, T>);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async set(data: Record<string, any>): Promise<void> {
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

  async remove(keys: string | string[]): Promise<void> {
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

  onChanged(
    callback: (changes: Record<string, { oldValue?: any; newValue?: any }>, areaName: string) => void
  ): () => void {
    const listener = (changes: chrome.storage.StorageChange, areaName: chrome.storage.StorageArea) => {
      const normalizedChanges: Record<string, { oldValue?: any; newValue?: any }> = {};
      for (const [key, change] of Object.entries(changes)) {
        normalizedChanges[key] = {
          oldValue: change.oldValue,
          newValue: change.newValue,
        };
      }
      callback(normalizedChanges, areaName as unknown as string);
    };

    chrome.storage.onChanged.addListener(listener as any);

    return () => {
      chrome.storage.onChanged.removeListener(listener as any);
    };
  }
}

/**
 * Chrome local storage implementation
 */
export class ChromeLocalStorage implements LocalStorageInterface {
  async get<T = any>(key: string | string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(data as Record<string, T>);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async set(data: Record<string, any>): Promise<void> {
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

  async remove(keys: string | string[]): Promise<void> {
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
}

// Export singleton instances
export const chromeStorage = new ChromeStorage();
export const chromeLocalStorage = new ChromeLocalStorage();
