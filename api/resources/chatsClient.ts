import type { ApiRequest } from '../fetcher';
import chatLimits from '@core/config/chatLimits.json';
import {
  validateChatListResponse,
  validateChatMessages,
  validateChatRecord,
  validateChatTitleResponse,
} from '../validation';

export function createChatsClient(apiRequest: ApiRequest) {
  interface ChatListResponse {
    chats: Record<string, unknown>[];
    pagination: {
      hasMore: boolean;
      nextCursor?: string | null;
    };
  }

  async function createChat(params: { title?: string; initialMessage?: string } = {}) {
    const raw = await apiRequest<unknown>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return validateChatRecord(raw, 'createChat');
  }

  async function getRecentChats(
    params: {
      limit?: number;
      cursor?: string | null;
    } = {},
  ): Promise<ChatListResponse> {
    const defaultLimit = Number(chatLimits.DEFAULT_CHAT_LIST_LIMIT) || 20;
    const { limit = defaultLimit, cursor } = params;
    const queryParams = new URLSearchParams();
    if (limit) {
      queryParams.set('limit', String(limit));
    }
    if (cursor) {
      queryParams.set('cursor', String(cursor));
    }

    const endpoint = `/api/chats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const raw = await apiRequest<unknown>(endpoint, {
      method: 'GET',
    });
    return validateChatListResponse(raw, 'getRecentChats');
  }

  async function getChatMessages(chatId: string): Promise<Record<string, unknown>[]> {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    const raw = await apiRequest<unknown>(`/api/chats/${chatId}/messages`, {
      method: 'GET',
    });
    return validateChatMessages(raw, 'getChatMessages');
  }

  async function deleteChat(chatId: string): Promise<void> {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    return apiRequest<void>(`/api/chats/${chatId}`, {
      method: 'DELETE',
    });
  }

  async function generateChatTitle(chatId: string): Promise<{ chatId: string; title: string }> {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    const raw = await apiRequest<unknown>(`/api/chats/${chatId}/title`, {
      method: 'POST',
    });
    return validateChatTitleResponse(raw, 'generateChatTitle');
  }

  return {
    createChat,
    getRecentChats,
    getChatMessages,
    deleteChat,
    generateChatTitle,
  };
}
