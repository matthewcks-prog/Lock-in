/**
 * useChat Hook
 *
 * Main orchestration hook that combines all chat functionality.
 * Provides a unified API for the sidebar component.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, UseChatOptions } from '../types';
import { useChatMessages } from './useChatMessages';
import { useChatHistory } from './useChatHistory';
import { useSendMessage } from './useSendMessage';
import { useSendMessageStream } from './useSendMessageStream';
import { createSendMessage } from './createSendMessage';
import { createSendSuccessHandler } from './createSendSuccessHandler';
import { createSelectChat } from './createSelectChat';
import { createStartBlankChat } from './createStartBlankChat';
import { createStartNewChat } from './createStartNewChat';
import { useMessageEdit } from './useMessageEdit';
import { useRegenerateMessage } from './useRegenerateMessage';
import type { UseChatReturn } from './chatHookTypes';
import { useChatSessionState } from './useChatSessionState';
import type { SendMessageMutationParams } from './sendMessageUtils';

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

  // Streaming message send
  const {
    sendMessageStream,
    isStreaming,
    streamedContent,
    meta: streamMeta,
    error: streamError,
    isComplete: streamComplete,
    cancelPending: cancelStream,
    reset: _resetStream,
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

  /**
   * Dispatches a regeneration request using the canonical timeline.
   * Used by both edit-as-rewrite and regenerate flows to avoid duplicating
   * a user message — the canonical timeline already contains it.
   *
   * When streaming is enabled, routes through the streaming path for
   * progressive content delivery; otherwise uses blocking mutation.
   */
  function dispatchRegeneration(canonicalMessages: ChatMessage[], chatId: string): void {
    const lastUserMsg = [...canonicalMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    const payload: SendMessageMutationParams = {
      message: lastUserMsg.content,
      source: 'followup',
      pageUrl,
      chatId,
      currentMessages: canonicalMessages,
      activeChatId: chatId,
    };
    if (courseCode) {
      payload.courseCode = courseCode;
    }

    if (enableStreaming && sendMessageStream) {
      void sendMessageStream(payload);
    } else {
      sendMessageMutation(payload);
    }
  }

  // Message editing (auto-cancels stream, auto-regenerates after save)
  const messageEdit = useMessageEdit({
    apiClient,
    chatId: activeChatId,
    cancelStream,
    onEditComplete: (_editedContent, canonicalMessages) => {
      // After a successful edit, the backend has already:
      //   1. Marked the old message as non-canonical
      //   2. Inserted the revision as canonical
      //   3. Truncated all subsequent messages
      // The canonicalMessages array already contains the revised user message.
      // We must NOT re-add a user message — just trigger a new assistant response.
      if (activeChatId) {
        dispatchRegeneration(canonicalMessages, activeChatId);
      }
    },
  });

  // Regeneration (auto-cancels stream, then re-triggers with canonical timeline)
  const regeneration = useRegenerateMessage({
    apiClient,
    chatId: activeChatId,
    cancelStream,
    onRegenerateReady: (canonicalMessages) => {
      if (activeChatId) {
        dispatchRegeneration(canonicalMessages, activeChatId);
      }
    },
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
    messageEdit,
    regeneration,
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
