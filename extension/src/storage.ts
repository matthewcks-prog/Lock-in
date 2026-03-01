import { z } from 'zod';
import {
  CLIENT_STORAGE_KEYS,
  canonicalizeClientStorageKey,
  expandClientStorageKeyList,
} from '../../core/storage/clientStorageKeys';

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
  SIDEBAR_IS_OPEN: CLIENT_STORAGE_KEYS.SIDEBAR_IS_OPEN,
  SIDEBAR_ACTIVE_TAB: CLIENT_STORAGE_KEYS.SIDEBAR_ACTIVE_TAB,
  SIDEBAR_WIDTH: CLIENT_STORAGE_KEYS.SIDEBAR_WIDTH,
  CURRENT_CHAT_ID: CLIENT_STORAGE_KEYS.CURRENT_CHAT_ID,
  ACTIVE_CHAT_ID: CLIENT_STORAGE_KEYS.ACTIVE_CHAT_ID,
  HIGHLIGHTING_ENABLED: CLIENT_STORAGE_KEYS.HIGHLIGHTING_ENABLED,
  SELECTED_NOTE_ID: CLIENT_STORAGE_KEYS.SELECTED_NOTE_ID,
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const SIDEBAR_TAB_SCHEMA = z.enum(['chat', 'notes', 'study', 'tasks', 'tool']);
const NON_EMPTY_STRING_SCHEMA = z.string().min(1);
const NULLABLE_STRING_SCHEMA = z.string().min(1).nullable();
const BOOLEAN_SCHEMA = z.boolean();
const POSITIVE_NUMBER_SCHEMA = z.number().positive();

const SYNC_SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  [STORAGE_KEYS.SIDEBAR_IS_OPEN]: BOOLEAN_SCHEMA,
  [STORAGE_KEYS.SIDEBAR_ACTIVE_TAB]: SIDEBAR_TAB_SCHEMA,
  [STORAGE_KEYS.HIGHLIGHTING_ENABLED]: BOOLEAN_SCHEMA,
  [STORAGE_KEYS.SELECTED_NOTE_ID]: NULLABLE_STRING_SCHEMA,
  [STORAGE_KEYS.ACTIVE_CHAT_ID]: NULLABLE_STRING_SCHEMA,
};

const LOCAL_SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  [STORAGE_KEYS.CURRENT_CHAT_ID]: NON_EMPTY_STRING_SCHEMA,
  [STORAGE_KEYS.SIDEBAR_IS_OPEN]: BOOLEAN_SCHEMA,
  [STORAGE_KEYS.SIDEBAR_WIDTH]: POSITIVE_NUMBER_SCHEMA,
};

function asStorageKeyList(keys: string | string[]): string[] {
  return Array.isArray(keys) ? keys : [keys];
}

function normalizeStorageReadValues(values: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    const canonicalKey = canonicalizeClientStorageKey(key);
    if (normalized[canonicalKey] === undefined || canonicalKey === key) {
      normalized[canonicalKey] = value;
    }
  });
  return normalized;
}

function mirrorRequestedStorageKeys(
  keys: string | string[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const mirrored: Record<string, unknown> = { ...values };
  asStorageKeyList(keys).forEach((requestedKey) => {
    const canonicalKey = canonicalizeClientStorageKey(requestedKey);
    if (requestedKey === canonicalKey) return;
    if (mirrored[requestedKey] !== undefined) return;
    if (mirrored[canonicalKey] !== undefined) {
      mirrored[requestedKey] = mirrored[canonicalKey];
    }
  });
  return mirrored;
}

function normalizeStorageWriteData(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    normalized[canonicalizeClientStorageKey(key)] = value;
  });
  return normalized;
}

function sanitizeStorageValues(
  values: Record<string, unknown>,
  schemaMap: Record<string, z.ZodTypeAny>,
  areaLabel: string,
): Record<string, unknown> {
  const normalizedValues = normalizeStorageReadValues(values);
  const sanitized: Record<string, unknown> = { ...normalizedValues };
  Object.entries(normalizedValues).forEach(([key, value]) => {
    const schema = schemaMap[key];
    if (schema === undefined) return;
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
  const normalizedData = normalizeStorageWriteData(data);
  const sanitized: Record<string, unknown> = {};
  const invalidKeys: string[] = [];
  Object.entries(normalizedData).forEach(([key, value]) => {
    const schema = schemaMap[key];
    if (schema === undefined) {
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

async function withChromeCallback<T>(executor: (done: (result: T) => void) => void): Promise<T> {
  return await new Promise((resolve, reject) => {
    try {
      executor((result) => {
        if (chrome.runtime.lastError !== null && chrome.runtime.lastError !== undefined) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function getFromStorageArea<T = unknown>(
  area: 'sync' | 'local',
  keys: string | string[],
  schemaMap: Record<string, z.ZodTypeAny>,
  areaLabel: string,
): Promise<Record<string, T>> {
  const expandedKeys = expandClientStorageKeyList(asStorageKeyList(keys));
  const result = await withChromeCallback<Record<string, unknown>>((done) => {
    chrome.storage[area].get(expandedKeys, (result) => done(result ?? {}));
  });
  const sanitized = sanitizeStorageValues(result, schemaMap, areaLabel);
  return mirrorRequestedStorageKeys(keys, sanitized) as Record<string, T>;
}

async function setInStorageArea(
  area: 'sync' | 'local',
  data: Record<string, unknown>,
  schemaMap: Record<string, z.ZodTypeAny>,
  areaLabel: string,
): Promise<void> {
  const sanitized = validateStorageWrite(data, schemaMap, areaLabel);
  return await withChromeCallback<void>((done) => {
    chrome.storage[area].set(sanitized, () => done(undefined));
  });
}

async function removeFromStorageArea(
  area: 'sync' | 'local',
  keys: string | string[],
): Promise<void> {
  const expandedKeys = expandClientStorageKeyList(asStorageKeyList(keys));
  return await withChromeCallback<void>((done) => {
    chrome.storage[area].remove(expandedKeys, () => done(undefined));
  });
}

function createStorageChangeListener(
  callback: (changes: Record<string, StorageChange>, areaName: string) => void,
) {
  return (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
    const normalizedChanges: Record<string, StorageChange> = {};
    for (const key in changes) {
      const change = changes[key];
      if (change === undefined) continue;
      normalizedChanges[key] = {
        oldValue: change.oldValue,
        newValue: change.newValue,
      };
    }
    callback(normalizedChanges, areaName);
  };
}

function createStorage(): Storage {
  return {
    STORAGE_KEYS,
    get: async <T = unknown>(keys: string | string[]) =>
      getFromStorageArea<T>('sync', keys, SYNC_SCHEMA_MAP, 'sync'),
    set: async (data: Record<string, unknown>) =>
      setInStorageArea('sync', data, SYNC_SCHEMA_MAP, 'sync'),
    remove: async (keys: string | string[]) => removeFromStorageArea('sync', keys),
    getLocal: async <T = unknown>(keys: string | string[]) =>
      getFromStorageArea<T>('local', keys, LOCAL_SCHEMA_MAP, 'local'),
    setLocal: async (key: string, value: unknown) =>
      setInStorageArea('local', { [key]: value }, LOCAL_SCHEMA_MAP, 'local'),
    removeLocal: async (keys: string | string[]) => removeFromStorageArea('local', keys),
    onChanged: (callback: (changes: Record<string, StorageChange>, areaName: string) => void) => {
      const listener = createStorageChangeListener(callback);
      chrome.storage.onChanged.addListener(listener);
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
