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
  createTasksClient,
  type ListTasksParams,
  type TaskPayload,
  type TaskOrderItem,
} from './resources/tasksClient';
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
import {
  createStudyClient,
  type GenerateStudySummaryParams,
  type StudyClient,
} from './resources/studyClient';
import { createUsersClient } from './resources/usersClient';
import type { StudySummaryDepth, StudySummaryResponse } from './validationStudy';

type FetcherClient = ReturnType<typeof createFetcher>;
type LockinClient = ReturnType<typeof createLockinClient>;
type ChatsClient = ReturnType<typeof createChatsClient>;
type NotesClient = ReturnType<typeof createNotesClient>;
type TasksClient = ReturnType<typeof createTasksClient>;
type AssetsClient = ReturnType<typeof createAssetsClient>;
type ChatAssetsClient = ReturnType<typeof createChatAssetsClient>;
type FeedbackClient = ReturnType<typeof createFeedbackClient>;
type TranscriptsClient = ReturnType<typeof createTranscriptsClient>;
type StudyClientResource = ReturnType<typeof createStudyClient>;
type UsersClient = ReturnType<typeof createUsersClient>;
type ResourceClients = LockinClient &
  ChatsClient &
  NotesClient &
  TasksClient &
  AssetsClient &
  ChatAssetsClient &
  FeedbackClient &
  TranscriptsClient &
  StudyClientResource &
  UsersClient;

export type ApiClient = FetcherClient &
  LockinClient &
  ChatsClient &
  NotesClient &
  TasksClient &
  AssetsClient &
  ChatAssetsClient &
  FeedbackClient &
  TranscriptsClient &
  StudyClientResource &
  UsersClient;

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
  const tasks = createTasksClient(apiRequest);
  const assets = createAssetsClient(apiRequest);
  const chatAssets = createChatAssetsClient(apiRequest);
  const feedback = createFeedbackClient(apiRequest);
  const transcripts = createTranscriptsClient(apiRequest);
  const study = createStudyClient(apiRequest);
  const users = createUsersClient(apiRequest);

  return {
    ...lockin,
    ...chats,
    ...notes,
    ...tasks,
    ...assets,
    ...chatAssets,
    ...feedback,
    ...transcripts,
    ...study,
    ...users,
  };
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetcher = createFetcher(buildFetcherConfig(config));

  // Build streaming config for SSE endpoints
  const streamingConfig: StreamingConfig = {
    backendUrl: config.backendUrl,
    getAccessToken: async () =>
      config.authClient.getValidAccessToken().then((token) => token ?? ''),
  };
  if (config.fetcher !== undefined) {
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
  GenerateStudySummaryParams,
  StudySummaryDepth,
  StudySummaryResponse,
};
export type { EditMessageResponse, RegenerateResponse } from './resources/chatsClient';
export type { ListTasksParams, TaskPayload, TaskOrderItem };
export type {
  StreamEvent,
  StreamMetaEvent,
  StreamDeltaEvent,
  StreamFinalEvent,
  StreamErrorEvent,
} from './fetcher/sseParser';
export type { StudyClient };
