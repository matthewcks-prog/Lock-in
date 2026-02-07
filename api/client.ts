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
import {
  createLockinClient,
  type ProcessTextParams,
  type ProcessTextStreamParams,
  type ProcessTextStreamResult,
  type StreamingConfig,
} from './resources/lockinClient';
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
  type ChatAssetStatus,
  type UploadChatAssetParams,
  type ListChatAssetsParams,
  type GetChatAssetStatusParams,
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

type FetcherClient = ReturnType<typeof createFetcher>;
type LockinClient = ReturnType<typeof createLockinClient>;
type ChatsClient = ReturnType<typeof createChatsClient>;
type NotesClient = ReturnType<typeof createNotesClient>;
type AssetsClient = ReturnType<typeof createAssetsClient>;
type ChatAssetsClient = ReturnType<typeof createChatAssetsClient>;
type FeedbackClient = ReturnType<typeof createFeedbackClient>;
type TranscriptsClient = ReturnType<typeof createTranscriptsClient>;
type ResourceClients = LockinClient &
  ChatsClient &
  NotesClient &
  AssetsClient &
  ChatAssetsClient &
  FeedbackClient &
  TranscriptsClient;

export type ApiClient = FetcherClient &
  LockinClient &
  ChatsClient &
  NotesClient &
  AssetsClient &
  ChatAssetsClient &
  FeedbackClient &
  TranscriptsClient;

export type ApiClientConfig = {
  backendUrl: string;
  authClient: AuthClient;
  fetcher?: FetchLike;
};

type FetcherConfigInput = {
  backendUrl: string;
  authClient: AuthClient;
  fetcher?: FetchLike;
};

function buildFetcherConfig(config: ApiClientConfig): FetcherConfigInput {
  const fetcherConfig: FetcherConfigInput = {
    backendUrl: config.backendUrl,
    authClient: config.authClient,
  };
  if (config.fetcher !== undefined) {
    fetcherConfig.fetcher = config.fetcher;
  }
  return fetcherConfig;
}

function createResourceClients(
  apiRequest: FetcherClient['apiRequest'],
  streamingConfig: StreamingConfig,
): ResourceClients {
  const lockin = createLockinClient(apiRequest, streamingConfig);
  const chats = createChatsClient(apiRequest);
  const notes = createNotesClient(apiRequest);
  const assets = createAssetsClient(apiRequest);
  const chatAssets = createChatAssetsClient(apiRequest);
  const feedback = createFeedbackClient(apiRequest);
  const transcripts = createTranscriptsClient(apiRequest);

  return {
    ...lockin,
    ...chats,
    ...notes,
    ...assets,
    ...chatAssets,
    ...feedback,
    ...transcripts,
  };
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetcher = createFetcher(buildFetcherConfig(config));

  // Build streaming config for SSE endpoints
  const streamingConfig: StreamingConfig = {
    backendUrl: config.backendUrl,
    getAccessToken: async () =>
      config.authClient.getValidAccessToken().then((token) => token || ''),
  };
  if (config.fetcher) {
    streamingConfig.fetcher = config.fetcher;
  }

  const resources = createResourceClients(fetcher.apiRequest, streamingConfig);

  return {
    ...fetcher,
    ...resources,
  };
}

export { ConflictError } from './fetcher';
export type {
  ApiRequestOptions,
  ProcessTextParams,
  ProcessTextStreamParams,
  ProcessTextStreamResult,
  ListNotesParams,
  SearchNotesParams,
  ChatWithNotesParams,
  UploadNoteAssetParams,
  ListNoteAssetsParams,
  DeleteNoteAssetParams,
  ChatAsset,
  ChatAssetStatus,
  UploadChatAssetParams,
  ListChatAssetsParams,
  GetChatAssetStatusParams,
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
export type {
  StreamEvent,
  StreamMetaEvent,
  StreamDeltaEvent,
  StreamFinalEvent,
  StreamErrorEvent,
} from './fetcher/sseParser';
