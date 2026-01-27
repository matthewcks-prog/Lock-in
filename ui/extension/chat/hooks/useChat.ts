/**
 * useChat Hook
 *
 * Main orchestration hook that combines all chat functionality.
 * Provides a unified API for the sidebar component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ChatAttachment,
  ChatMessage,
  ChatHistoryItem,
  UseChatOptions,
  HistoryTitleSource,
} from '../types';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';
import {
  isValidUUID,
  buildInitialChatTitle,
  coerceChatTitle,
  FALLBACK_CHAT_TITLE,
  ACTIVE_CHAT_ID_KEY,
  normalizeChatMessage,
} from '../types';
import { useChatMessages, chatMessagesKeys } from './useChatMessages';
import { useChatHistory } from './useChatHistory';
import { useSendMessage } from './useSendMessage';

interface SendChatMessageOptions {
  source?: 'selection' | 'followup';
  attachments?: ChatAttachment[];
  attachmentIds?: string[];
  selectionOverride?: string;
  userMessageOverride?: string;
  transcriptContext?: TranscriptCacheInput;
}

interface UseChatReturn {
  // Current chat state
  activeChatId: string | null;
  activeHistoryId: string | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;

  // History
  recentChats: ChatHistoryItem[];
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  loadMoreHistory: () => Promise<unknown>;

  // Actions
  sendMessage: (
    message: string,
    options?: 'selection' | 'followup' | SendChatMessageOptions,
  ) => void;
  startNewChat: (text: string, options?: 'selection' | 'followup' | SendChatMessageOptions) => void;
  startBlankChat: () => void;
  selectChat: (item: ChatHistoryItem) => Promise<void>;
  ensureChatId: (initialMessage?: string) => Promise<string | null>;

  // Status
  isSending: boolean;
  error: Error | null;
  clearError: () => void;

  // History panel
  isHistoryOpen: boolean;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function coerceSendOptions(
  options?: 'selection' | 'followup' | SendChatMessageOptions,
): SendChatMessageOptions {
  if (!options) return {};
  if (typeof options === 'string') {
    return { source: options };
  }
  return options;
}

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

  // Local state
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeChatIdRef = useRef<string | null>(null);
  const activeHistoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    activeHistoryIdRef.current = activeHistoryId;
  }, [activeHistoryId]);

  // Composed hooks
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

  const { sendMessage: sendMessageMutation, isSending } = useSendMessage({
    apiClient,
    mode,
    pageUrl,
    courseCode,
    onSuccess: (response, resolvedChatId) => {
      const now = new Date().toISOString();
      const previousChatId = activeChatIdRef.current || activeHistoryIdRef.current;
      if (previousChatId && previousChatId !== resolvedChatId) {
        const cachedMessages = queryClient.getQueryData<ChatMessage[]>(
          chatMessagesKeys.byId(previousChatId),
        );
        if (cachedMessages && cachedMessages.length > 0) {
          queryClient.setQueryData(chatMessagesKeys.byId(resolvedChatId), cachedMessages);
        }
      }
      const fallbackTitle = buildInitialChatTitle(response.explanation.slice(0, 50));
      const serverTitle = response.chatTitle;
      const resolvedTitle = serverTitle
        ? coerceChatTitle(serverTitle, fallbackTitle)
        : fallbackTitle;
      const titleSource: HistoryTitleSource = serverTitle ? 'server' : 'local';

      setActiveChatId(resolvedChatId);
      setActiveHistoryId(resolvedChatId);

      upsertHistory(
        {
          id: resolvedChatId,
          title: resolvedTitle,
          updatedAt: now,
          lastMessage: response.explanation,
        },
        activeHistoryIdRef.current !== resolvedChatId ? activeHistoryIdRef.current : undefined,
        titleSource,
      );
    },
    onError: (err) => {
      setError(err);
    },
  });

  // Load active chat from storage on mount
  useEffect(() => {
    if (!storage) return;

    storage
      .get(ACTIVE_CHAT_ID_KEY)
      .then(async (storedChatId) => {
        if (storedChatId && isValidUUID(storedChatId)) {
          setActiveChatId(storedChatId);
          setActiveHistoryId(storedChatId);
        }
      })
      .catch(() => {
        // Ignore storage errors
      });
  }, [storage]);

  // Persist active chat ID when it changes
  useEffect(() => {
    if (!storage) return;
    if (activeChatId && isValidUUID(activeChatId)) {
      storage.set(ACTIVE_CHAT_ID_KEY, activeChatId).catch(() => {
        /* ignore */
      });
    }
  }, [activeChatId, storage]);

  const ensureChatId = useCallback(
    async (initialMessage?: string): Promise<string | null> => {
      const existingChatId = activeChatIdRef.current;
      if (existingChatId && isValidUUID(existingChatId)) {
        return existingChatId;
      }
      if (!apiClient?.createChat) {
        throw new Error('Chat session is not available');
      }

      const fallbackTitle = buildInitialChatTitle(initialMessage || '');
      const chat = await apiClient.createChat({ title: fallbackTitle });
      if (!chat?.id) {
        throw new Error('Failed to create chat session');
      }

      setActiveChatId(chat.id);
      setActiveHistoryId(chat.id);

      return chat.id;
    },
    [apiClient],
  );

  /**
   * Start a new chat with initial message.
   */
  const startNewChat = useCallback(
    (text: string, options?: 'selection' | 'followup' | SendChatMessageOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const resolvedOptions = coerceSendOptions(options);
      const source = resolvedOptions.source || 'selection';
      const attachments = resolvedOptions.attachments;
      const attachmentIds = resolvedOptions.attachmentIds;
      const selectionOverride = resolvedOptions.selectionOverride;
      const userMessageOverride = resolvedOptions.userMessageOverride;
      const transcriptContext = resolvedOptions.transcriptContext;

      const now = new Date().toISOString();
      const provisionalChatId = `chat-${Date.now()}`;

      const userMessage: ChatMessage = {
        id: `${provisionalChatId}-user`,
        role: 'user',
        content: trimmed,
        timestamp: now,
        mode,
        source,
        attachments,
      };

      // Reset state for new chat
      setIsHistoryOpen(false);
      setError(null);
      setActiveChatId(null);
      setActiveHistoryId(provisionalChatId);

      // Set initial messages in cache
      setMessages(provisionalChatId, [userMessage]);

      // Add to history optimistically
      upsertHistory(
        {
          id: provisionalChatId,
          title: buildInitialChatTitle(trimmed),
          updatedAt: now,
          lastMessage: trimmed,
        },
        undefined,
        'local',
      );

      // Temporarily set the provisional ID as active so the mutation can work
      setActiveChatId(provisionalChatId);

      // Send the message
      sendMessageMutation({
        message: trimmed,
        mode,
        source,
        pageUrl,
        courseCode: courseCode || undefined,
        chatId: null,
        currentMessages: [userMessage],
        activeChatId: provisionalChatId,
        attachmentIds,
        selectionOverride,
        userMessageOverride,
        transcriptContext,
      });
    },
    [mode, pageUrl, courseCode, setMessages, upsertHistory, sendMessageMutation],
  );

  /**
   * Send a message to the current chat (follow-up).
   */
  const sendMessage = useCallback(
    (text: string, options?: 'selection' | 'followup' | SendChatMessageOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const resolvedOptions = coerceSendOptions(options);
      const source = resolvedOptions.source || 'followup';
      const attachments = resolvedOptions.attachments;
      const attachmentIds = resolvedOptions.attachmentIds;
      const selectionOverride = resolvedOptions.selectionOverride;
      const userMessageOverride = resolvedOptions.userMessageOverride;
      const transcriptContext = resolvedOptions.transcriptContext;

      const hasChatContext = Boolean(activeChatId || activeHistoryId);

      // If no active chat context, start a new one
      if (messages.length === 0 && !hasChatContext) {
        startNewChat(trimmed, resolvedOptions);
        return;
      }

      const now = new Date().toISOString();
      const provisionalChatId = isValidUUID(activeChatId)
        ? (activeChatId as string)
        : activeHistoryId || `chat-${Date.now()}`;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: now,
        mode,
        source,
        attachments,
      };

      setIsHistoryOpen(false);
      setError(null);
      setActiveHistoryId(provisionalChatId);

      // Add user message to cache
      const currentMessages =
        queryClient.getQueryData<ChatMessage[]>(
          chatMessagesKeys.byId(activeChatId || provisionalChatId),
        ) || messages;
      const nextMessages = [...currentMessages, userMessage];

      queryClient.setQueryData(
        chatMessagesKeys.byId(activeChatId || provisionalChatId),
        nextMessages,
      );

      // Update history
      upsertHistory(
        {
          id: provisionalChatId,
          title: buildInitialChatTitle(trimmed),
          updatedAt: now,
          lastMessage: trimmed,
        },
        undefined,
        'local',
      );

      // Send the message
      sendMessageMutation({
        message: trimmed,
        mode,
        source,
        pageUrl,
        courseCode: courseCode || undefined,
        chatId: activeChatId,
        currentMessages: nextMessages,
        activeChatId: activeChatId || provisionalChatId,
        attachmentIds,
        selectionOverride,
        userMessageOverride,
        transcriptContext,
      });
    },
    [
      activeChatId,
      activeHistoryId,
      messages,
      mode,
      pageUrl,
      courseCode,
      queryClient,
      startNewChat,
      upsertHistory,
      sendMessageMutation,
    ],
  );

  /**
   * Start a blank chat (no initial message).
   */
  const startBlankChat = useCallback(() => {
    const now = new Date().toISOString();
    const provisionalChatId = `chat-${Date.now()}`;

    setIsHistoryOpen(false);
    setError(null);
    setActiveChatId(provisionalChatId);
    setActiveHistoryId(provisionalChatId);

    // Clear messages cache for new chat
    setMessages(provisionalChatId, []);

    // Add to history
    upsertHistory(
      {
        id: provisionalChatId,
        title: FALLBACK_CHAT_TITLE,
        updatedAt: now,
        lastMessage: '',
      },
      undefined,
      'local',
    );
  }, [setMessages, upsertHistory]);

  /**
   * Select and load an existing chat from history.
   */
  const selectChat = useCallback(
    async (item: ChatHistoryItem) => {
      if (!apiClient?.getChatMessages) return;

      setError(null);
      setActiveHistoryId(item.id);
      setActiveChatId(item.id);

      try {
        const response = await apiClient.getChatMessages(item.id);
        if (Array.isArray(response)) {
          const normalized: ChatMessage[] = response.map((msg) => normalizeChatMessage(msg, mode));
          setMessages(item.id, normalized);
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error('Failed to load chat messages');
        setError(error);
      }
    },
    [apiClient, mode, setMessages],
  );

  const clearError = useCallback(() => setError(null), []);

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
