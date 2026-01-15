import type { ApiRequest } from '../fetcher';
import chatLimits from '@core/config/chatLimits.json';

export function createChatsClient(apiRequest: ApiRequest) {
  interface ChatListResponse {
    chats: any[];
    pagination: {
      hasMore: boolean;
      nextCursor?: string | null;
    };
  }

  async function createChat(params: { title?: string; initialMessage?: string } = {}) {
    return apiRequest<{
      id: string;
      title: string | null;
      createdAt: string;
      updatedAt: string;
      lastMessageAt: string | null;
    }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async function getRecentChats(params: { limit?: number; cursor?: string | null } = {}): Promise<ChatListResponse> {
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
    return apiRequest<ChatListResponse>(endpoint, {
      method: 'GET',
    });
  }

  async function getChatMessages(chatId: string): Promise<any[]> {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    return apiRequest<any[]>(`/api/chats/${chatId}/messages`, {
      method: 'GET',
    });
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

    return apiRequest<{ chatId: string; title: string }>(`/api/chats/${chatId}/title`, {
      method: 'POST',
    });
  }

  return {
    createChat,
    getRecentChats,
    getChatMessages,
    deleteChat,
    generateChatTitle,
  };
}
