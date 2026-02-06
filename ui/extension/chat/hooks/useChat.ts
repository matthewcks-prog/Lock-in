/**
 * useChat Hook
 *
 * Main orchestration hook that combines all chat functionality.
 * Provides a unified API for the sidebar component.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { UseChatOptions } from '../types';
import { useChatMessages } from './useChatMessages';
import { useChatHistory } from './useChatHistory';
import { useSendMessage } from './useSendMessage';
import { createSendMessage } from './createSendMessage';
import { createSendSuccessHandler } from './createSendSuccessHandler';
import { createSelectChat } from './createSelectChat';
import { createStartBlankChat } from './createStartBlankChat';
import { createStartNewChat } from './createStartNewChat';
import type { UseChatReturn } from './chatHookTypes';
import { useChatSessionState } from './useChatSessionState';

/**
 * Main chat hook that orchestrates all chat functionality.
 *
 * Features:
 * - Manages active chat session state
 * - Coordinates message sending with history updates
 * - Handles storage persistence for active chat ID
 */
export function useChat(options: UseChatOptions): UseChatReturn {
  const { apiClient, storage, mode, pageUrl, courseCode } = options;
  const queryClient = useQueryClient();

  const {
    activeChatId,
    setActiveChatId,
    activeHistoryId,
    setActiveHistoryId,
    activeChatIdRef,
    activeHistoryIdRef,
    isHistoryOpen,
    setIsHistoryOpen,
    error,
    setError,
    clearError,
    ensureChatId,
  } = useChatSessionState({ apiClient, storage });

  const {
    messages,
    isLoading: isLoadingMessages,
    setMessages,
  } = useChatMessages({
    apiClient,
    chatId: activeChatId,
    mode,
  });

  const {
    recentChats,
    isLoading: isLoadingHistory,
    hasMore: hasMoreHistory,
    loadMore: loadMoreHistory,
    isFetchingNextPage: isLoadingMoreHistory,
    upsertHistory,
  } = useChatHistory({
    apiClient,
  });

  const handleSendSuccess = createSendSuccessHandler({
    queryClient,
    activeChatIdRef,
    activeHistoryIdRef,
    setActiveChatId,
    setActiveHistoryId,
    upsertHistory,
  });

  const { sendMessage: sendMessageMutation, isSending } = useSendMessage({
    apiClient,
    mode,
    pageUrl,
    courseCode,
    onSuccess: handleSendSuccess,
    onError: (err) => {
      setError(err);
    },
  });

  const startNewChat = createStartNewChat({
    mode,
    pageUrl,
    courseCode,
    setMessages,
    upsertHistory,
    sendMessage: sendMessageMutation,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });

  const sendMessage = createSendMessage({
    activeChatId,
    activeHistoryId,
    messages,
    mode,
    pageUrl,
    courseCode,
    queryClient,
    upsertHistory,
    sendMessage: sendMessageMutation,
    startNewChat,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });

  const startBlankChat = createStartBlankChat({
    setMessages,
    upsertHistory,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });

  const selectChat = createSelectChat({
    apiClient,
    mode,
    setActiveChatId,
    setActiveHistoryId,
    setError,
    setMessages,
  });

  return {
    activeChatId,
    activeHistoryId,
    messages,
    isLoadingMessages,
    recentChats,
    isLoadingHistory,
    hasMoreHistory,
    isLoadingMoreHistory,
    loadMoreHistory,
    sendMessage,
    startNewChat,
    startBlankChat,
    selectChat,
    ensureChatId,
    isSending,
    error,
    clearError,
    isHistoryOpen,
    setIsHistoryOpen,
  };
}
