/**
 * Chat Assets API Client
 *
 * Client for uploading, listing, and deleting chat message attachments.
 * Mirrors the pattern from assetsClient.ts
 */

import type { ApiRequest } from '../fetcher';
import {
  validateChatAssetRecord,
  validateChatAssetRecords,
  validateChatAssetStatus,
} from '../validation';

export interface ChatAsset {
  id: string;
  messageId: string | null;
  type: 'image' | 'document' | 'code' | 'other';
  mimeType: string;
  fileName: string | null;
  fileSize: number | null;
  url: string | null;
  createdAt: string;
  processingStatus?: 'pending' | 'processing' | 'ready' | 'error' | null;
  processingError?: string | null;
  processingUpdatedAt?: string | null;
  processingCompletedAt?: string | null;
}

export interface UploadChatAssetParams {
  chatId: string;
  file: File | Blob;
}

export interface ListChatAssetsParams {
  chatId: string;
}

export interface DeleteChatAssetParams {
  assetId: string;
}

export interface GetChatAssetStatusParams {
  assetId: string;
}

export interface ChatAssetStatus {
  id: string;
  processingStatus?: 'pending' | 'processing' | 'ready' | 'error' | null;
  processingError?: string | null;
  processingUpdatedAt?: string | null;
  processingCompletedAt?: string | null;
}

type ChatAssetRecord = {
  id: string;
  messageId?: string | null;
  message_id?: string | null;
  type: ChatAsset['type'];
  mimeType?: string | null;
  mime_type?: string | null;
  fileName?: string | null;
  file_name?: string | null;
  fileSize?: number | null;
  file_size?: number | null;
  url?: string | null;
  createdAt?: string;
  created_at?: string;
  processingStatus?: string | null;
  processing_status?: string | null;
  processingError?: string | null;
  processing_error?: string | null;
  processingUpdatedAt?: string | null;
  processing_updated_at?: string | null;
  processingCompletedAt?: string | null;
  processing_completed_at?: string | null;
};

type ChatAssetStatusRecord = {
  id: string;
  processingStatus?: string | null;
  processing_status?: string | null;
  processingError?: string | null;
  processing_error?: string | null;
  processingUpdatedAt?: string | null;
  processing_updated_at?: string | null;
  processingCompletedAt?: string | null;
  processing_completed_at?: string | null;
};

function resolveString(value?: string | null): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function resolveNumber(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function assertNonEmptyString(value: unknown, message: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
}

function resolveProcessingStatus(
  value?: string | null,
): 'pending' | 'processing' | 'ready' | 'error' | null {
  switch (value) {
    case 'pending':
    case 'processing':
    case 'ready':
    case 'error':
      return value;
    default:
      return null;
  }
}

function mapChatAsset(raw: ChatAssetRecord): ChatAsset {
  return {
    id: raw.id,
    messageId: resolveString(raw.messageId) ?? resolveString(raw.message_id),
    type: raw.type,
    mimeType: resolveString(raw.mimeType) ?? resolveString(raw.mime_type) ?? '',
    fileName: resolveString(raw.fileName) ?? resolveString(raw.file_name),
    fileSize: resolveNumber(raw.fileSize) ?? resolveNumber(raw.file_size),
    url: resolveString(raw.url),
    createdAt:
      resolveString(raw.createdAt) ?? resolveString(raw.created_at) ?? new Date().toISOString(),
    processingStatus: resolveProcessingStatus(
      resolveString(raw.processingStatus) ?? resolveString(raw.processing_status),
    ),
    processingError:
      resolveString(raw.processingError) ?? resolveString(raw.processing_error) ?? null,
    processingUpdatedAt:
      resolveString(raw.processingUpdatedAt) ?? resolveString(raw.processing_updated_at) ?? null,
    processingCompletedAt:
      resolveString(raw.processingCompletedAt) ??
      resolveString(raw.processing_completed_at) ??
      null,
  };
}

function mapChatAssetStatus(raw: ChatAssetStatusRecord): ChatAssetStatus {
  return {
    id: raw.id,
    processingStatus: resolveProcessingStatus(
      resolveString(raw.processingStatus) ?? resolveString(raw.processing_status),
    ),
    processingError:
      resolveString(raw.processingError) ?? resolveString(raw.processing_error) ?? null,
    processingUpdatedAt:
      resolveString(raw.processingUpdatedAt) ?? resolveString(raw.processing_updated_at) ?? null,
    processingCompletedAt:
      resolveString(raw.processingCompletedAt) ??
      resolveString(raw.processing_completed_at) ??
      null,
  };
}

export type ChatAssetsClient = {
  uploadChatAsset: (params: UploadChatAssetParams) => Promise<ChatAsset>;
  listChatAssets: (params: ListChatAssetsParams) => Promise<ChatAsset[]>;
  getChatAssetStatus: (params: GetChatAssetStatusParams) => Promise<ChatAssetStatus>;
  deleteChatAsset: (params: DeleteChatAssetParams) => Promise<void>;
};

const createUploadChatAsset =
  (apiRequest: ApiRequest) =>
  async (params: UploadChatAssetParams): Promise<ChatAsset> => {
    const { chatId, file } = params;
    assertNonEmptyString(chatId, 'chatId is required to upload an asset');
    if (file === undefined || file === null) {
      throw new Error('file is required to upload an asset');
    }

    const formData = new FormData();
    formData.append('file', file);

    const raw = await apiRequest<unknown>(`/api/chats/${chatId}/assets`, {
      method: 'POST',
      body: formData,
    });

    return mapChatAsset(validateChatAssetRecord(raw, 'uploadChatAsset') as ChatAssetRecord);
  };

const createListChatAssets =
  (apiRequest: ApiRequest) =>
  async (params: ListChatAssetsParams): Promise<ChatAsset[]> => {
    const { chatId } = params;
    assertNonEmptyString(chatId, 'chatId is required to list assets');

    const raw = await apiRequest<unknown>(`/api/chats/${chatId}/assets`, {
      method: 'GET',
    });

    return validateChatAssetRecords(raw, 'listChatAssets').map((record) =>
      mapChatAsset(record as ChatAssetRecord),
    );
  };

const createGetChatAssetStatus =
  (apiRequest: ApiRequest) =>
  async (params: GetChatAssetStatusParams): Promise<ChatAssetStatus> => {
    const { assetId } = params;
    assertNonEmptyString(assetId, 'assetId is required to fetch asset status');

    const raw = await apiRequest<unknown>(`/api/chat-assets/${assetId}/status`, {
      method: 'GET',
    });

    return mapChatAssetStatus(
      validateChatAssetStatus(raw, 'getChatAssetStatus') as ChatAssetStatusRecord,
    );
  };

const createDeleteChatAsset =
  (apiRequest: ApiRequest) =>
  async (params: DeleteChatAssetParams): Promise<void> => {
    const { assetId } = params;
    assertNonEmptyString(assetId, 'assetId is required to delete an asset');

    return apiRequest<void>(`/api/chat-assets/${assetId}`, {
      method: 'DELETE',
    });
  };

export function createChatAssetsClient(apiRequest: ApiRequest): ChatAssetsClient {
  return {
    uploadChatAsset: createUploadChatAsset(apiRequest),
    listChatAssets: createListChatAssets(apiRequest),
    getChatAssetStatus: createGetChatAssetStatus(apiRequest),
    deleteChatAsset: createDeleteChatAsset(apiRequest),
  };
}
