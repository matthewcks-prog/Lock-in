/**
 * Chat Assets API Client
 *
 * Client for uploading, listing, and deleting chat message attachments.
 * Mirrors the pattern from assetsClient.ts
 */

import type { ApiRequest } from '../fetcher';
import { validateChatAssetRecord, validateChatAssetRecords } from '../validation';

export interface ChatAsset {
  id: string;
  messageId: string | null;
  type: 'image' | 'document' | 'code' | 'other';
  mimeType: string;
  fileName: string | null;
  fileSize: number | null;
  url: string | null;
  createdAt: string;
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

function mapChatAsset(raw: any): ChatAsset {
  return {
    id: raw.id,
    messageId: raw.messageId || raw.message_id || null,
    type: raw.type,
    mimeType: raw.mimeType || raw.mime_type,
    fileName: raw.fileName ?? raw.file_name ?? null,
    fileSize: raw.fileSize ?? raw.file_size ?? null,
    url: raw.url ?? null,
    createdAt: raw.createdAt || raw.created_at,
  };
}

export function createChatAssetsClient(apiRequest: ApiRequest) {
  /**
   * Upload a file as a chat attachment
   * @param params - Upload parameters including chatId and file
   * @returns The created chat asset with URL
   */
  async function uploadChatAsset(params: UploadChatAssetParams): Promise<ChatAsset> {
    const { chatId, file } = params;
    if (!chatId) {
      throw new Error('chatId is required to upload an asset');
    }
    if (!file) {
      throw new Error('file is required to upload an asset');
    }

    const formData = new FormData();
    formData.append('file', file);

    const raw = await apiRequest<unknown>(`/api/chats/${chatId}/assets`, {
      method: 'POST',
      body: formData,
    });

    return mapChatAsset(validateChatAssetRecord(raw, 'uploadChatAsset'));
  }

  /**
   * List all assets for a chat
   * @param params - List parameters including chatId
   * @returns Array of chat assets with URLs
   */
  async function listChatAssets(params: ListChatAssetsParams): Promise<ChatAsset[]> {
    const { chatId } = params;
    if (!chatId) {
      throw new Error('chatId is required to list assets');
    }

    const raw = await apiRequest<unknown>(`/api/chats/${chatId}/assets`, {
      method: 'GET',
    });

    return validateChatAssetRecords(raw, 'listChatAssets').map(mapChatAsset);
  }

  /**
   * Delete a chat asset
   * @param params - Delete parameters including assetId
   */
  async function deleteChatAsset(params: DeleteChatAssetParams): Promise<void> {
    const { assetId } = params;
    if (!assetId) {
      throw new Error('assetId is required to delete an asset');
    }

    return apiRequest<void>(`/api/chat-assets/${assetId}`, {
      method: 'DELETE',
    });
  }

  return {
    uploadChatAsset,
    listChatAssets,
    deleteChatAsset,
  };
}
