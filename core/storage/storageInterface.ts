/**
 * Storage Interface
 *
 * Abstraction for storage operations that can be implemented by:
 * - Chrome extension (chrome.storage)
 * - Web app (localStorage)
 * - Node.js (file system or database)
 *
 * No Chrome dependencies - pure interface.
 */

/**
 * Storage interface for key-value operations
 */
export type StorageInterface = {
  /**
   * Get value(s) from storage
   */
  get<T = unknown>(key: string | string[]): Promise<Record<string, T>>;

  /**
   * Set value(s) in storage
   */
  set<T = unknown>(data: Record<string, T>): Promise<void>;

  /**
   * Remove key(s) from storage
   */
  remove(keys: string | string[]): Promise<void>;

  /**
   * Listen for storage changes
   */
  onChanged<T = unknown>(
    callback: (changes: Record<string, { oldValue?: T; newValue?: T }>, areaName: string) => void,
  ): () => void;
};

/**
 * Local storage interface (for per-tab or temporary data)
 */
export type LocalStorageInterface = {
  get<T = unknown>(key: string | string[]): Promise<Record<string, T>>;
  set<T = unknown>(data: Record<string, T>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};
