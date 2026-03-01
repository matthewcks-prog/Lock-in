import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../storage';
import type { LockInContentRuntime } from '../contentRuntime';

type StorageItems = Record<string, unknown>;
type StorageGetFn = (keys: string | string[], callback: (items: StorageItems) => void) => void;
type StorageSetFn = (items: StorageItems, callback: () => void) => void;
type StorageRemoveFn = (keys: string | string[], callback: () => void) => void;
type RuntimeSendMessageFn = (message: unknown, callback: (response: StorageItems) => void) => void;
type TabsSendMessageFn = (
  tabId: number,
  message: unknown,
  callback: (response: StorageItems) => void,
) => void;

describe('contentRuntime surface', () => {
  let createContentRuntime: () => LockInContentRuntime;
  let mockStorageLocalGet: ReturnType<typeof vi.fn<StorageGetFn>>;

  beforeEach(async () => {
    vi.resetModules();

    const mockStorageSync = {
      get: vi.fn<StorageGetFn>((_keys, callback) => callback({})),
      set: vi.fn<StorageSetFn>((_items, callback) => callback()),
      remove: vi.fn<StorageRemoveFn>((_keys, callback) => callback()),
    };

    mockStorageLocalGet = vi.fn<StorageGetFn>((_keys, callback) => callback({}));
    const mockStorageLocal = {
      get: mockStorageLocalGet,
      set: vi.fn<StorageSetFn>((_items, callback) => callback()),
      remove: vi.fn<StorageRemoveFn>((_keys, callback) => callback()),
    };

    const mockOnChanged = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    const mockRuntime = {
      sendMessage: vi.fn<RuntimeSendMessageFn>((_message, callback) =>
        callback({ data: { tabId: 1 } }),
      ),
      lastError: undefined,
    };

    const mockTabs = {
      sendMessage: vi.fn<TabsSendMessageFn>((_tabId, _message, callback) => callback({})),
    };

    global.chrome = {
      storage: {
        sync: mockStorageSync,
        local: mockStorageLocal,
        onChanged: mockOnChanged,
      } as unknown as typeof chrome.storage,
      runtime: mockRuntime as unknown as typeof chrome.runtime,
      tabs: mockTabs as unknown as typeof chrome.tabs,
    } as typeof chrome;

    ({ createContentRuntime } = await import('../contentRuntime'));
    // ensure clean slate for window runtime
    delete window.LockInContent;
  });

  it('exposes a versioned runtime with required keys on window', () => {
    const runtime = createContentRuntime();
    window.LockInContent = runtime;

    expect(window.LockInContent).toBeDefined();
    expect(runtime.__version).toBe('1.0');
    expect(window.LockInContent.__version).toBe('1.0');
    expect(window.LockInContent.storage).toBeDefined();
    expect(window.LockInContent.messaging).toBeDefined();
    expect(window.LockInContent.session).toBeDefined();
    expect(window.LockInContent.logger).toBeDefined();
    expect(typeof runtime.storage.getLocal).toBe('function');
    expect(typeof runtime.messaging.types.GET_TAB_ID).toBe('string');
    expect(typeof runtime.session.getSession).toBe('function');
    expect(typeof runtime.logger.info).toBe('function');
    // legacy compat surface must not exist
    // @ts-expect-error - legacy compat removed
    expect(window.LockInContent.Storage).toBeUndefined();
    // @ts-expect-error - legacy compat removed
    expect(window.LockInContent.MessageTypes).toBeUndefined();
  });

  it('provides storage helpers that can be called (regression for missing getLocal)', async () => {
    const mockChatId = 'chat-123';
    mockStorageLocalGet.mockImplementation(
      (_keys: string | string[], cb: (value: Record<string, unknown>) => void) =>
        cb({ [STORAGE_KEYS.CURRENT_CHAT_ID]: mockChatId }),
    );

    const runtime = createContentRuntime();
    const chatId = await runtime.session.loadChatId();

    expect(chatId).toBe(mockChatId);
    expect(mockStorageLocalGet).toHaveBeenCalled();
  });
});
