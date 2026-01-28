/**
 * useChatMessages Hook
 *
 * TanStack Query-based hook for fetching and caching chat messages.
 * Provides automatic caching, refetching, and loading states.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ChatMessage, UseChatMessagesOptions } from '../types';
import { isValidUUID, normalizeChatMessage } from '../types';

/**
 * Normalizes API response to ChatMessage array.
 */
function normalizeMessages(response: unknown, mode: UseChatMessagesOptions['mode']): ChatMessage[] {
  if (!Array.isArray(response)) return [];
  return response.map((message) => normalizeChatMessage(message, mode));
}

/**
 * Query key factory for chat messages.
 */
export const chatMessagesKeys = {
  all: ['chatMessages'] as const,
  byId: (chatId: string | null) => ['chatMessages', chatId] as const,
};

/**
 * Hook for fetching chat messages with TanStack Query.
 *
 * Features:
 * - Automatic caching and deduplication
 * - Loading/error states managed by query
 * - Stale-while-revalidate pattern
 * - Suspense-ready if needed
 */
export function useChatMessages(options: UseChatMessagesOptions) {
  const { apiClient, chatId, mode } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: chatMessagesKeys.byId(chatId),
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!chatId || !apiClient?.getChatMessages) {
        return [];
      }

      const response = await apiClient.getChatMessages(chatId);
      return normalizeMessages(response, mode);
    },
    enabled: Boolean(chatId) && Boolean(apiClient?.getChatMessages) && isValidUUID(chatId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Optimistically add a message to the cache.
   * Used when sending a new message or receiving a response.
   */
  const addMessage = useCallback(
    (message: ChatMessage) => {
      if (!chatId) return;

      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) => [
        ...old,
        message,
      ]);
    },
    [chatId, queryClient],
  );

  /**
   * Update a specific message in the cache.
   * Used for updating pending messages after API response.
   */
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      if (!chatId) return;

      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
        old.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
      );
    },
    [chatId, queryClient],
  );

  /**
   * Set all messages for a chat.
   * Used when starting a new chat or loading from history.
   */
  const setMessages = useCallback(
    (targetChatId: string, messages: ChatMessage[]) => {
      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(targetChatId), messages);
    },
    [queryClient],
  );

  /**
   * Clear messages cache for a chat.
   */
  const clearMessages = useCallback(
    (targetChatId?: string) => {
      const key = targetChatId ? chatMessagesKeys.byId(targetChatId) : chatMessagesKeys.all;
      queryClient.removeQueries({ queryKey: key });
    },
    [queryClient],
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
