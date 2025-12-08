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
export interface StorageInterface {
  /**
   * Get value(s) from storage
   */
  get<T = any>(key: string | string[]): Promise<Record<string, T>>;

  /**
   * Set value(s) in storage
   */
  set(data: Record<string, any>): Promise<void>;

  /**
   * Remove key(s) from storage
   */
  remove(keys: string | string[]): Promise<void>;

  /**
   * Listen for storage changes
   */
  onChanged(callback: (changes: Record<string, { oldValue?: any; newValue?: any }>, areaName: string) => void): () => void;
}

/**
 * Local storage interface (for per-tab or temporary data)
 */
export interface LocalStorageInterface {
  get<T = any>(key: string | string[]): Promise<Record<string, T>>;
  set(data: Record<string, any>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}
