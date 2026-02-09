import type { ApiRequest } from '../fetcher';
import chatLimits from '@core/config/chatLimits.json';
import {
  validateChatListResponse,
  validateChatMessages,
  validateChatRecord,
  validateChatTitleResponse,
} from '../validation';

export type ChatListResponse = {
  chats: Record<string, unknown>[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string | null;
  };
};

export type EditMessageResponse = {
  revision: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
    revisionOf: string;
  };
  canonicalMessages: Record<string, unknown>[];
  truncatedCount: number;
};

export type RegenerateResponse = {
  canonicalMessages: Record<string, unknown>[];
  truncatedCount: number;
};

export type ChatsClient = {
  createChat: (params?: {
    title?: string;
    initialMessage?: string;
  }) => Promise<Record<string, unknown>>;
  getRecentChats: (params?: {
    limit?: number;
    cursor?: string | null;
  }) => Promise<ChatListResponse>;
  getChatMessages: (chatId: string) => Promise<Record<string, unknown>[]>;
  deleteChat: (chatId: string) => Promise<void>;
  generateChatTitle: (chatId: string) => Promise<{ chatId: string; title: string }>;
  editMessage: (chatId: string, messageId: string, content: string) => Promise<EditMessageResponse>;
  regenerateMessage: (chatId: string) => Promise<RegenerateResponse>;
};

const FALLBACK_CHAT_LIST_LIMIT = 20;
const parsedDefaultLimit = Number(chatLimits.DEFAULT_CHAT_LIST_LIMIT);
const DEFAULT_CHAT_LIST_LIMIT = Number.isFinite(parsedDefaultLimit)
  ? parsedDefaultLimit
  : FALLBACK_CHAT_LIST_LIMIT;

function buildChatListQuery(params: { limit?: number; cursor?: string | null } = {}): string {
  const queryParams = new URLSearchParams();
  const limit =
    typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? params.limit
      : DEFAULT_CHAT_LIST_LIMIT;
  if (Number.isFinite(limit)) {
    queryParams.set('limit', String(limit));
  }
  if (typeof params.cursor === 'string' && params.cursor.length > 0) {
    queryParams.set('cursor', params.cursor);
  }
  const query = queryParams.toString();
  return query.length > 0 ? `?${query}` : '';
}

async function createChatRequest(
  apiRequest: ApiRequest,
  params: { title?: string; initialMessage?: string } = {},
): Promise<Record<string, unknown>> {
  const raw = await apiRequest<unknown>('/api/chats', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return validateChatRecord(raw, 'createChat');
}

async function getRecentChatsRequest(
  apiRequest: ApiRequest,
  params: { limit?: number; cursor?: string | null } = {},
): Promise<ChatListResponse> {
  const endpoint = `/api/chats${buildChatListQuery(params)}`;
  const raw = await apiRequest<unknown>(endpoint, {
    method: 'GET',
  });
  return validateChatListResponse(raw, 'getRecentChats');
}

async function getChatMessagesRequest(
  apiRequest: ApiRequest,
  chatId: string,
): Promise<Record<string, unknown>[]> {
  if (typeof chatId !== 'string' || chatId.length === 0) {
    throw new Error('Chat ID is required');
  }

  const raw = await apiRequest<unknown>(`/api/chats/${chatId}/messages`, {
    method: 'GET',
  });
  return validateChatMessages(raw, 'getChatMessages');
}

async function deleteChatRequest(apiRequest: ApiRequest, chatId: string): Promise<void> {
  if (typeof chatId !== 'string' || chatId.length === 0) {
    throw new Error('Chat ID is required');
  }

  return apiRequest<void>(`/api/chats/${chatId}`, {
    method: 'DELETE',
  });
}

async function generateChatTitleRequest(
  apiRequest: ApiRequest,
  chatId: string,
): Promise<{ chatId: string; title: string }> {
  if (typeof chatId !== 'string' || chatId.length === 0) {
    throw new Error('Chat ID is required');
  }

  const raw = await apiRequest<unknown>(`/api/chats/${chatId}/title`, {
    method: 'POST',
  });
  return validateChatTitleResponse(raw, 'generateChatTitle');
}

async function editMessageRequest(
  apiRequest: ApiRequest,
  chatId: string,
  messageId: string,
  content: string,
): Promise<EditMessageResponse> {
  if (!chatId || !messageId) {
    throw new Error('Chat ID and Message ID are required');
  }

  const raw = await apiRequest<EditMessageResponse>(`/api/chats/${chatId}/messages/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  return raw as EditMessageResponse;
}

async function regenerateMessageRequest(
  apiRequest: ApiRequest,
  chatId: string,
): Promise<RegenerateResponse> {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }

  const raw = await apiRequest<RegenerateResponse>(`/api/chats/${chatId}/regenerate`, {
    method: 'POST',
  });
  return raw as RegenerateResponse;
}

export function createChatsClient(apiRequest: ApiRequest): ChatsClient {
  return {
    createChat: async (params) => createChatRequest(apiRequest, params),
    getRecentChats: async (params) => getRecentChatsRequest(apiRequest, params),
    getChatMessages: async (chatId) => getChatMessagesRequest(apiRequest, chatId),
    deleteChat: async (chatId) => deleteChatRequest(apiRequest, chatId),
    generateChatTitle: async (chatId) => generateChatTitleRequest(apiRequest, chatId),
    editMessage: async (chatId, messageId, content) =>
      editMessageRequest(apiRequest, chatId, messageId, content),
    regenerateMessage: async (chatId) => regenerateMessageRequest(apiRequest, chatId),
  };
}
