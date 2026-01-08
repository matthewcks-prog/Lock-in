/**
 * API Client for Lock-in
 *
 * Chrome-agnostic API client for backend communication.
 * Uses auth client interface - no direct Chrome dependencies.
 *
 * Scalability features:
 * - Exponential backoff retry for transient failures
 * - Request deduplication via AbortController
 * - Optimistic locking support via updatedAt
 */

import type { AuthClient } from './auth';
import { createFetcher, type ApiRequestOptions } from './fetcher';
import { createLockinClient, type ProcessTextParams } from './resources/lockinClient';
import { createChatsClient } from './resources/chatsClient';
import {
  createNotesClient,
  type ListNotesParams,
  type SearchNotesParams,
  type ChatWithNotesParams,
} from './resources/notesClient';
import {
  createAssetsClient,
  type UploadNoteAssetParams,
  type ListNoteAssetsParams,
  type DeleteNoteAssetParams,
} from './resources/assetsClient';

export interface ApiClientConfig {
  backendUrl: string;
  authClient: AuthClient;
}

export function createApiClient(config: ApiClientConfig) {
  const fetcher = createFetcher(config);
  const { apiRequest, getBackendUrl } = fetcher;

  const { processText } = createLockinClient(apiRequest);
  const { getRecentChats, getChatMessages, deleteChat, generateChatTitle } =
    createChatsClient(apiRequest);
  const {
    createNote,
    updateNote,
    deleteNote,
    toggleNoteStar,
    setNoteStar,
    listNotes,
    searchNotes,
    chatWithNotes,
  } = createNotesClient(apiRequest);
  const { uploadNoteAsset, listNoteAssets, deleteNoteAsset } = createAssetsClient(apiRequest);

  return {
    apiRequest,
    getBackendUrl,
    processText,
    getRecentChats,
    getChatMessages,
    deleteChat,
    generateChatTitle,
    createNote,
    updateNote,
    deleteNote,
    toggleNoteStar,
    setNoteStar,
    listNotes,
    searchNotes,
    chatWithNotes,
    uploadNoteAsset,
    listNoteAssets,
    deleteNoteAsset,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export { ConflictError } from './fetcher';
export type {
  ApiRequestOptions,
  ProcessTextParams,
  ListNotesParams,
  SearchNotesParams,
  ChatWithNotesParams,
  UploadNoteAssetParams,
  ListNoteAssetsParams,
  DeleteNoteAssetParams,
};
