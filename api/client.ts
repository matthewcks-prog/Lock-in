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
import { createFetcher, type ApiRequestOptions, type FetchLike } from './fetcher';
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
import {
  createChatAssetsClient,
  type ChatAsset,
  type UploadChatAssetParams,
  type ListChatAssetsParams,
  type DeleteChatAssetParams,
} from './resources/chatAssetsClient';
import {
  createFeedbackClient,
  type SubmitFeedbackParams,
  type FeedbackType,
  type FeedbackStatus,
  type FeedbackContext,
  type FeedbackRecord,
} from './resources/feedbackClient';
import {
  createTranscriptsClient,
  type CacheTranscriptParams,
  type TranscriptCacheMeta,
  type TranscriptCacheResponse,
} from './resources/transcriptsClient';

export interface ApiClientConfig {
  backendUrl: string;
  authClient: AuthClient;
  fetcher?: FetchLike;
}

export function createApiClient(config: ApiClientConfig) {
  const fetcher = createFetcher({
    backendUrl: config.backendUrl,
    authClient: config.authClient,
    fetcher: config.fetcher,
  });
  const { apiRequest, getBackendUrl } = fetcher;

  const { processText } = createLockinClient(apiRequest);
  const { createChat, getRecentChats, getChatMessages, deleteChat, generateChatTitle } =
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
  const { uploadChatAsset, listChatAssets, deleteChatAsset } = createChatAssetsClient(apiRequest);
  const { submitFeedback, listFeedback, getFeedback } = createFeedbackClient(apiRequest);
  const { cacheTranscript } = createTranscriptsClient(apiRequest);

  return {
    apiRequest,
    getBackendUrl,
    processText,
    createChat,
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
    uploadChatAsset,
    listChatAssets,
    deleteChatAsset,
    submitFeedback,
    listFeedback,
    getFeedback,
    cacheTranscript,
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
  ChatAsset,
  UploadChatAssetParams,
  ListChatAssetsParams,
  DeleteChatAssetParams,
  SubmitFeedbackParams,
  FeedbackType,
  FeedbackStatus,
  FeedbackContext,
  FeedbackRecord,
  CacheTranscriptParams,
  TranscriptCacheMeta,
  TranscriptCacheResponse,
};
