import { beforeEach, describe, expect, it, vi } from 'vitest';

type StorageItems = Record<string, unknown>;
type StorageGetFn = (keys: string | string[], callback: (items: StorageItems) => void) => void;
type StorageSetFn = (items: StorageItems, callback: () => void) => void;
type StorageRemoveFn = (keys: string | string[], callback: () => void) => void;

describe('extension storage alias compatibility', () => {
  let storage: {
    get: (key: string | string[]) => Promise<Record<string, unknown>>;
    set: (data: Record<string, unknown>) => Promise<void>;
  };
  let STORAGE_KEYS: { SELECTED_NOTE_ID: string };
  let mockStorageSyncGet: ReturnType<typeof vi.fn<StorageGetFn>>;
  let mockStorageSyncSet: ReturnType<typeof vi.fn<StorageSetFn>>;

  beforeEach(async () => {
    vi.resetModules();

    mockStorageSyncGet = vi.fn<StorageGetFn>((_keys, callback) =>
      callback({ lockin_sidebar_selectedNoteId: 'legacy-note-id' }),
    );
    mockStorageSyncSet = vi.fn<StorageSetFn>((_items, callback) => callback());

    const mockStorageSync = {
      get: mockStorageSyncGet,
      set: mockStorageSyncSet,
      remove: vi.fn<StorageRemoveFn>((_keys, callback) => callback()),
    };

    const mockStorageLocal = {
      get: vi.fn<StorageGetFn>((_keys, callback) => callback({})),
      set: vi.fn<StorageSetFn>((_items, callback) => callback()),
      remove: vi.fn<StorageRemoveFn>((_keys, callback) => callback()),
    };

    const mockOnChanged = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    vi.stubGlobal('chrome', {
      storage: {
        sync: mockStorageSync,
        local: mockStorageLocal,
        onChanged: mockOnChanged,
      },
      runtime: {
        lastError: null,
      },
    });

    const storageModule = await import('../storage');
    storage = storageModule.storage;
    STORAGE_KEYS = storageModule.STORAGE_KEYS;
  });

  it('reads selected note id from legacy alias key', async () => {
    const result = await storage.get(STORAGE_KEYS.SELECTED_NOTE_ID);
    expect(result[STORAGE_KEYS.SELECTED_NOTE_ID]).toBe('legacy-note-id');
  });

  it('mirrors canonical values back to a requested alias key', async () => {
    const result = await storage.get('lockin_sidebar_selectedNoteId');
    expect(result['lockin_sidebar_selectedNoteId']).toBe('legacy-note-id');
  });

  it('writes canonical key when set receives alias keys', async () => {
    await storage.set({ lockin_sidebar_selectedNoteId: 'canonical-note-id' });

    expect(mockStorageSyncSet).toHaveBeenCalledWith(
      { [STORAGE_KEYS.SELECTED_NOTE_ID]: 'canonical-note-id' },
      expect.any(Function),
    );
  });
});
