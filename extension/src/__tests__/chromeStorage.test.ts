/**
 * Unit tests for chromeStorage
 *
 * Tests Chrome storage adapter with mocked Chrome APIs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeStorage, chromeLocalStorage } from '../chromeStorage';

// Mock Chrome APIs
const mockChromeStorageSync = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};

const mockChromeStorageLocal = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};

const mockChromeStorageOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

// Setup global chrome mock
beforeEach(() => {
  // @ts-expect-error - Mocking Chrome APIs
  global.chrome = {
    storage: {
      sync: mockChromeStorageSync,
      local: mockChromeStorageLocal,
      onChanged: mockChromeStorageOnChanged,
    },
    runtime: {
      lastError: null,
    },
  };

  // Reset all mocks
  vi.clearAllMocks();
  mockChromeStorageSync.get.mockImplementation((_keys, callback) => {
    callback({});
  });
  mockChromeStorageSync.set.mockImplementation((_data, callback) => {
    callback();
  });
  mockChromeStorageSync.remove.mockImplementation((_keys, callback) => {
    callback();
  });
  mockChromeStorageLocal.get.mockImplementation((_keys, callback) => {
    callback({});
  });
  mockChromeStorageLocal.set.mockImplementation((_data, callback) => {
    callback();
  });
  mockChromeStorageLocal.remove.mockImplementation((_keys, callback) => {
    callback();
  });
});

describe('chromeStorage', () => {
  describe('get', () => {
    it('should get values from chrome.storage.sync', async () => {
      mockChromeStorageSync.get.mockImplementation((_keys, callback) => {
        callback({ key1: 'value1', key2: 'value2' });
      });

      const result = await chromeStorage.get(['key1', 'key2']);

      expect(mockChromeStorageSync.get).toHaveBeenCalledWith(
        ['key1', 'key2'],
        expect.any(Function),
      );
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should handle single key', async () => {
      mockChromeStorageSync.get.mockImplementation((_key, callback) => {
        callback({ key1: 'value1' });
      });

      const result = await chromeStorage.get('key1');

      expect(result).toEqual({ key1: 'value1' });
    });

    it('should reject on Chrome runtime error', async () => {
      mockChromeStorageSync.get.mockImplementation((_keys, callback) => {
        // @ts-expect-error - Mocking Chrome error
        global.chrome.runtime.lastError = { message: 'Storage error' };
        callback({});
      });

      await expect(chromeStorage.get('key1')).rejects.toThrow('Storage error');
    });

    it('should reject on exception', async () => {
      mockChromeStorageSync.get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(chromeStorage.get('key1')).rejects.toThrow('Unexpected error');
    });
  });

  describe('set', () => {
    it('should set values in chrome.storage.sync', async () => {
      mockChromeStorageSync.set.mockImplementation((_data, callback) => {
        callback();
      });

      await chromeStorage.set({ key1: 'value1', key2: 'value2' });

      expect(mockChromeStorageSync.set).toHaveBeenCalledWith(
        { key1: 'value1', key2: 'value2' },
        expect.any(Function),
      );
    });

    it('should reject on Chrome runtime error', async () => {
      mockChromeStorageSync.set.mockImplementation((_data, callback) => {
        // @ts-expect-error - Mocking Chrome error
        global.chrome.runtime.lastError = { message: 'Storage error' };
        callback();
      });

      await expect(chromeStorage.set({ key: 'value' })).rejects.toThrow('Storage error');
    });
  });

  describe('remove', () => {
    it('should remove keys from chrome.storage.sync', async () => {
      mockChromeStorageSync.remove.mockImplementation((_keys, callback) => {
        callback();
      });

      await chromeStorage.remove(['key1', 'key2']);

      expect(mockChromeStorageSync.remove).toHaveBeenCalledWith(
        ['key1', 'key2'],
        expect.any(Function),
      );
    });

    it('should handle single key', async () => {
      mockChromeStorageSync.remove.mockImplementation((_key, callback) => {
        callback();
      });

      await chromeStorage.remove('key1');

      expect(mockChromeStorageSync.remove).toHaveBeenCalledWith('key1', expect.any(Function));
    });

    it('should reject on Chrome runtime error', async () => {
      mockChromeStorageSync.remove.mockImplementation((_keys, callback) => {
        // @ts-expect-error - Mocking Chrome error
        global.chrome.runtime.lastError = { message: 'Storage error' };
        callback();
      });

      await expect(chromeStorage.remove('key1')).rejects.toThrow('Storage error');
    });
  });

  describe('onChanged', () => {
    it('should subscribe to storage changes', () => {
      const callback = vi.fn();
      const unsubscribe = chromeStorage.onChanged(callback);

      expect(mockChromeStorageOnChanged.addListener).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should normalize Chrome storage change format', () => {
      const callback = vi.fn();
      chromeStorage.onChanged(callback);

      const listener = mockChromeStorageOnChanged.addListener.mock.calls[0]?.[0];
      expect(listener).toBeDefined();
      listener?.(
        {
          key1: { oldValue: 'old', newValue: 'new' },
          key2: { oldValue: undefined, newValue: 'added' },
        },
        'sync',
      );

      expect(callback).toHaveBeenCalledWith(
        {
          key1: { oldValue: 'old', newValue: 'new' },
          key2: { oldValue: undefined, newValue: 'added' },
        },
        'sync',
      );
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = chromeStorage.onChanged(callback);

      unsubscribe();

      expect(mockChromeStorageOnChanged.removeListener).toHaveBeenCalled();
    });
  });
});

describe('chromeLocalStorage', () => {
  describe('get', () => {
    it('should get values from chrome.storage.local', async () => {
      mockChromeStorageLocal.get.mockImplementation((_keys, callback) => {
        callback({ key1: 'value1' });
      });

      const result = await chromeLocalStorage.get(['key1']);

      expect(mockChromeStorageLocal.get).toHaveBeenCalledWith(['key1'], expect.any(Function));
      expect(result).toEqual({ key1: 'value1' });
    });
  });

  describe('set', () => {
    it('should set values in chrome.storage.local', async () => {
      mockChromeStorageLocal.set.mockImplementation((_data, callback) => {
        callback();
      });

      await chromeLocalStorage.set({ key1: 'value1' });

      expect(mockChromeStorageLocal.set).toHaveBeenCalledWith(
        { key1: 'value1' },
        expect.any(Function),
      );
    });
  });

  describe('remove', () => {
    it('should remove keys from chrome.storage.local', async () => {
      mockChromeStorageLocal.remove.mockImplementation((_keys, callback) => {
        callback();
      });

      await chromeLocalStorage.remove(['key1']);

      expect(mockChromeStorageLocal.remove).toHaveBeenCalledWith(['key1'], expect.any(Function));
    });
  });

  describe('onChanged', () => {
    it('should only fire for local storage changes', () => {
      const callback = vi.fn();
      chromeLocalStorage.onChanged(callback);

      const listener = mockChromeStorageOnChanged.addListener.mock.calls[0]?.[0];
      expect(listener).toBeDefined();

      // Should ignore sync changes
      listener?.({ key1: { newValue: 'value' } }, 'sync');
      expect(callback).not.toHaveBeenCalled();

      // Should fire for local changes
      listener?.({ key1: { newValue: 'value' } }, 'local');
      expect(callback).toHaveBeenCalled();
    });
  });
});
