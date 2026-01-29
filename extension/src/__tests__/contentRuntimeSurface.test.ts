import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../storage';
import type { LockInContentRuntime } from '../contentRuntime';

describe('contentRuntime surface', () => {
  let createContentRuntime: () => LockInContentRuntime;
  let mockStorageLocalGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    const mockStorageSync = {
      get: vi.fn((_, cb) => cb({})),
      set: vi.fn((_, cb) => cb()),
      remove: vi.fn((_, cb) => cb()),
    };

    mockStorageLocalGet = vi.fn((_, cb) => cb({}));
    const mockStorageLocal = {
      get: mockStorageLocalGet,
      set: vi.fn((_, cb) => cb()),
      remove: vi.fn((_, cb) => cb()),
    };

    const mockOnChanged = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    const mockRuntime = {
      sendMessage: vi.fn((_, cb) => cb({ data: { tabId: 1 } })),
      lastError: null,
    };

    const mockTabs = {
      sendMessage: vi.fn((_, __, cb) => cb({})),
    };

    // @ts-expect-error - chrome is provided by the browser
    global.chrome = {
      storage: {
        sync: mockStorageSync,
        local: mockStorageLocal,
        onChanged: mockOnChanged,
      },
      runtime: mockRuntime,
      tabs: mockTabs,
    };

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
