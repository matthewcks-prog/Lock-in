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
import { useSendMessageStream } from './useSendMessageStream';
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
 * - Optional streaming support (enableStreaming flag)
 */
export function useChat(options: UseChatOptions): UseChatReturn {
  const { apiClient, storage, pageUrl, courseCode, enableStreaming } = options;
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

  // Blocking (non-streaming) message send
  const { sendMessage: sendMessageMutation, isSending: isSendingBlocking } = useSendMessage({
    apiClient,
    pageUrl,
    courseCode,
    onSuccess: handleSendSuccess,
    onError: (err) => {
      setError(err);
    },
  });

  // Streaming message send (only active when enableStreaming is true)
  // Note: sendMessageStream and resetStream available for future UI integration
  const {
    // sendMessageStream, // Reserved for direct streaming API
    isStreaming,
    streamedContent,
    meta: streamMeta,
    error: streamError,
    isComplete: streamComplete,
    cancelPending: cancelStream,
    // reset: resetStream, // Reserved for stream reset
  } = useSendMessageStream({
    apiClient,
    pageUrl,
    courseCode,
    onSuccess: handleSendSuccess,
    onError: (err) => {
      setError(err);
    },
  });

  // Combined sending state
  const isSending = enableStreaming ? isStreaming : isSendingBlocking;

  const startNewChat = createStartNewChat({
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
    setActiveChatId,
    setActiveHistoryId,
    setError,
    setMessages,
  });

  // Build base return object
  const baseReturn: UseChatReturn = {
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

  // Add streaming fields only if streaming is enabled (exactOptionalPropertyTypes)
  if (enableStreaming) {
    baseReturn.streaming = {
      isStreaming,
      streamedContent,
      meta: streamMeta,
      error: streamError,
      isComplete: streamComplete,
    };
    baseReturn.cancelStream = cancelStream;
  }

  return baseReturn;
}
