/**
 * useChatMessages Hook
 *
 * TanStack Query-based hook for fetching and caching chat messages.
 * Provides automatic caching, refetching, and loading states.
 */

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ChatMessage, UseChatMessagesOptions } from '../types';
import { isValidUUID, normalizeChatMessage } from '../types';

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MESSAGE_STALE_TIME_MINUTES = 5;

/**
 * Normalizes API response to ChatMessage array.
 */
function normalizeMessages(response: unknown): ChatMessage[] {
  if (!Array.isArray(response)) return [];
  return response.map((message) => normalizeChatMessage(message));
}

/**
 * Query key factory for chat messages.
 */
export const chatMessagesKeys = {
  all: ['chatMessages'] as const,
  byId: (chatId: string | null) => ['chatMessages', chatId] as const,
};

interface UseChatMessagesResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  setMessages: (targetChatId: string, messages: ChatMessage[]) => void;
  clearMessages: (targetChatId?: string) => void;
}

interface MessageCacheMutations {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  setMessages: (targetChatId: string, messages: ChatMessage[]) => void;
  clearMessages: (targetChatId?: string) => void;
}

function useChatMessagesQuery(
  apiClient: UseChatMessagesOptions['apiClient'],
  chatId: UseChatMessagesOptions['chatId'],
): UseQueryResult<ChatMessage[], Error> {
  return useQuery<ChatMessage[], Error>({
    queryKey: chatMessagesKeys.byId(chatId),
    queryFn: async (): Promise<ChatMessage[]> => {
      if (chatId === null || chatId.length === 0 || apiClient?.getChatMessages === undefined) {
        return [];
      }

      const response = await apiClient.getChatMessages(chatId);
      return normalizeMessages(response);
    },
    enabled:
      chatId !== null &&
      chatId.length > 0 &&
      apiClient?.getChatMessages !== undefined &&
      isValidUUID(chatId),
    staleTime: MESSAGE_STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
  });
}

function useMessageCacheMutations(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string | null,
): MessageCacheMutations {
  const addMessage = useCallback(
    (message: ChatMessage) => {
      if (chatId === null || chatId.length === 0) return;

      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) => [
        ...old,
        message,
      ]);
    },
    [chatId, queryClient],
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      if (chatId === null || chatId.length === 0) return;

      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
        old.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
      );
    },
    [chatId, queryClient],
  );

  const setMessages = useCallback(
    (targetChatId: string, messages: ChatMessage[]) => {
      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(targetChatId), messages);
    },
    [queryClient],
  );

  const clearMessages = useCallback(
    (targetChatId?: string) => {
      const key =
        targetChatId !== undefined && targetChatId.length > 0
          ? chatMessagesKeys.byId(targetChatId)
          : chatMessagesKeys.all;
      queryClient.removeQueries({ queryKey: key });
    },
    [queryClient],
  );

  return { addMessage, updateMessage, setMessages, clearMessages };
}

/**
 * Hook for fetching chat messages with TanStack Query.
 *
 * Features:
 * - Automatic caching and deduplication
 * - Loading/error states managed by query
 * - Stale-while-revalidate pattern
 * - Suspense-ready if needed
 */
export function useChatMessages(options: UseChatMessagesOptions): UseChatMessagesResult {
  const { apiClient, chatId } = options;
  const queryClient = useQueryClient();
  const query = useChatMessagesQuery(apiClient, chatId);
  const { addMessage, updateMessage, setMessages, clearMessages } = useMessageCacheMutations(
    queryClient,
    chatId,
  );

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    addMessage,
    updateMessage,
    setMessages,
    clearMessages,
  };
}
