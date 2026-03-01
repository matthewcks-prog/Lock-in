import { vi } from 'vitest';
import type { ApiClient } from '@api/client';
import type { NotesService } from '@core/services/notesService';
import type { StorageAdapter } from '@ui/extension/sidebar/types';

export function createStorageStub(values: Record<string, unknown> = {}): StorageAdapter {
  const get = vi.fn(async <T = unknown>(key: string) =>
    Promise.resolve(Object.prototype.hasOwnProperty.call(values, key) ? (values[key] as T) : null),
  ) as StorageAdapter['get'];

  const getLocal = vi.fn(async <T = unknown>() => Promise.resolve<T | null>(null)) as NonNullable<
    StorageAdapter['getLocal']
  >;

  return {
    get,
    set: vi.fn(async () => Promise.resolve()),
    getLocal,
    setLocal: vi.fn(async () => Promise.resolve()),
  } satisfies StorageAdapter;
}

export function createApiClientStub(overrides: Partial<ApiClient> = {}): ApiClient {
  const base: Partial<ApiClient> = {
    apiRequest: vi.fn(),
    processText: vi.fn(),
    processTextStream: vi.fn(),
    createChat: vi.fn(),
    getRecentChats: vi.fn(),
    getChatMessages: vi.fn(),
    deleteChat: vi.fn(),
    generateChatTitle: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    toggleNoteStar: vi.fn(),
    setNoteStar: vi.fn(),
    listNotes: vi.fn(),
    searchNotes: vi.fn(),
    chatWithNotes: vi.fn(),
    uploadNoteAsset: vi.fn(),
    listNoteAssets: vi.fn(),
    deleteNoteAsset: vi.fn(),
    uploadChatAsset: vi.fn(),
    listChatAssets: vi.fn(),
    deleteChatAsset: vi.fn(),
    getChatAssetStatus: vi.fn(),
    submitFeedback: vi.fn(),
    listFeedback: vi.fn(),
    getFeedback: vi.fn(),
    cacheTranscript: vi.fn(),
  };

  return {
    ...base,
    ...overrides,
  } as ApiClient;
}

export function createNotesServiceStub(overrides: Partial<NotesService> = {}): NotesService {
  const base: Partial<NotesService> = {
    listNotes: vi.fn().mockResolvedValue([]),
    getNote: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    toggleStar: vi.fn(),
    setStar: vi.fn(),
    listAssets: vi.fn(),
    uploadAsset: vi.fn(),
    deleteAsset: vi.fn(),
  };

  return {
    ...base,
    ...overrides,
  } as NotesService;
}
