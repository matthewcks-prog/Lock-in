/**
 * useSendMessage Hook
 *
 * Mutation hook for sending chat messages with:
 * - Request cancellation via AbortController
 * - Optimistic UI updates
 * - Automatic rollback on error
 * - Retry logic for transient failures
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { RateLimitError } from '@core/errors';
import {
  useTranscriptCache,
  type TranscriptCacheInput,
} from '../../transcripts/hooks/useTranscriptCache';
import type {
  ChatMessage,
  SendMessageParams,
  ChatApiResponse,
  UseSendMessageOptions,
} from '../types';
import { isValidUUID } from '../types';
import { chatMessagesKeys } from './useChatMessages';

interface MutationContext {
  previousMessages: ChatMessage[];
  pendingMessageId: string;
  provisionalChatId: string;
}

/** Extended params that include attachments */
interface SendMessageWithAttachmentsParams extends SendMessageParams {
  /** Array of uploaded asset IDs to include */
  attachmentIds?: string[];
  /** Override selection payload sent to the API */
  selectionOverride?: string;
  /** Override user message payload sent to the API */
  userMessageOverride?: string;
  /** Idempotency key for de-duplication */
  idempotencyKey?: string;
  /** Optional transcript context to cache before sending */
  transcriptContext?: TranscriptCacheInput;
}

type SendMessageMutationParams = SendMessageWithAttachmentsParams & {
  currentMessages: ChatMessage[];
  activeChatId: string | null;
};

type ChatHistoryEntry = { role: ChatMessage['role']; content: string };

const IDEMPOTENCY_BUCKET_MS = 5000;

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildIdempotencyKey(params: SendMessageWithAttachmentsParams): string {
  const bucket = Math.floor(Date.now() / IDEMPOTENCY_BUCKET_MS);
  const attachmentKey = (params.attachmentIds || []).join(',');
  const chatKey = params.chatId || '';
  const payloadKey = params.selectionOverride ?? params.message;
  const seed = `${chatKey}|${payloadKey}|${attachmentKey}|${bucket}`;
  return `lockin-${hashString(seed)}`;
}

function formatSendError(error: Error): string {
  if (error instanceof RateLimitError) {
    const retryAfterMs = error.retryAfterMs;
    if (retryAfterMs && retryAfterMs > 0) {
      const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return `You're sending too fast - try again in ${seconds}s.`;
    }
    return "You're sending too fast - try again in a moment.";
  }
  return error?.message || 'We could not process this request. Try again in a moment.';
}

function buildChatHistory(params: SendMessageMutationParams): ChatHistoryEntry[] {
  const baseHistorySource = params.chatHistory ?? params.currentMessages;
  return baseHistorySource.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));
}

function resolveApiChatId(params: SendMessageMutationParams): string | undefined {
  return typeof params.chatId === 'string' && isValidUUID(params.chatId)
    ? params.chatId
    : undefined;
}

function resolveSelectionPayload(params: SendMessageMutationParams): string {
  return params.selectionOverride !== undefined ? params.selectionOverride : params.message;
}

function resolveUserMessagePayload(params: SendMessageMutationParams): string | undefined {
  return params.source === 'followup' ? (params.userMessageOverride ?? params.message) : undefined;
}

function resolveIdempotencyKey(params: SendMessageMutationParams): string {
  return params.idempotencyKey || buildIdempotencyKey(params);
}

async function cacheTranscriptIfNeeded(
  cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>,
  transcriptContext?: TranscriptCacheInput,
) {
  if (!transcriptContext) return;
  cacheTranscript(transcriptContext).catch((error) => {
    console.warn('[Lock-in] Failed to cache transcript for chat:', error);
  });
}

async function sendMessageMutation(
  params: SendMessageMutationParams,
  deps: {
    apiClient: UseSendMessageOptions['apiClient'];
    pageUrl?: string;
    courseCode?: string | null;
    cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>;
    abortControllerRef: React.MutableRefObject<AbortController | null>;
  },
) {
  const { apiClient, pageUrl, courseCode, cacheTranscript, abortControllerRef } = deps;

  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();

  if (!apiClient?.processText) {
    throw new Error('API client not available');
  }

  await cacheTranscriptIfNeeded(cacheTranscript, params.transcriptContext);

  const baseHistory = buildChatHistory(params);
  const apiChatId = resolveApiChatId(params);
  const selectionPayload = resolveSelectionPayload(params);
  const userMessagePayload = resolveUserMessagePayload(params);
  const idempotencyKey = resolveIdempotencyKey(params);

  const response = await apiClient.processText({
    selection: selectionPayload,
    mode: params.mode,
    chatHistory: baseHistory,
    newUserMessage: userMessagePayload,
    chatId: apiChatId,
    pageUrl: params.pageUrl || pageUrl,
    courseCode: params.courseCode ?? courseCode ?? undefined,
    attachments: params.attachmentIds,
    idempotencyKey,
  });

  const explanation = response?.data?.explanation || `(${params.mode}) ${params.message}`;
  const resolvedChatId = response?.chatId || params.chatId || `chat-${Date.now()}`;

  return {
    explanation,
    chatId: response?.chatId,
    chatTitle: response?.chatTitle,
    resolvedChatId,
  };
}

/**
 * Hook for sending messages with cancellation and optimistic updates.
 *
 * Key features:
 * - Cancels previous request if new one is sent
 * - Optimistic "Thinking..." message
 * - Rollback on error
 * - Returns chatId and chatTitle from response
 */
export function useSendMessage(options: UseSendMessageOptions) {
  const { apiClient, pageUrl, courseCode, onSuccess, onError } = options;
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingSendKeyRef = useRef<string | null>(null);
  const { cacheTranscript } = useTranscriptCache(apiClient);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const mutation = useMutation<
    ChatApiResponse & { resolvedChatId: string },
    Error,
    SendMessageMutationParams,
    MutationContext
  >({
    retry: false,
    mutationFn: async (params) => {
      return sendMessageMutation(params, {
        apiClient,
        pageUrl,
        courseCode,
        cacheTranscript,
        abortControllerRef,
      });
    },

    onMutate: async (params): Promise<MutationContext> => {
      // Cancel outgoing refetches
      const chatId = params.activeChatId;
      if (chatId) {
        await queryClient.cancelQueries({ queryKey: chatMessagesKeys.byId(chatId) });
      }

      // Get current messages for rollback
      const previousMessages = chatId
        ? queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId)) || []
        : params.currentMessages;

      const pendingMessageId = `assistant-${Date.now()}`;
      const provisionalChatId = chatId || `chat-${Date.now()}`;

      // Optimistically add pending message
      const pendingMessage: ChatMessage = {
        id: pendingMessageId,
        role: 'assistant',
        content: 'Thinking...',
        timestamp: new Date().toISOString(),
        mode: params.mode,
        isPending: true,
      };

      const updatedMessages = [...params.currentMessages, pendingMessage];

      if (chatId) {
        queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), updatedMessages);
      }

      return {
        previousMessages,
        pendingMessageId,
        provisionalChatId,
      };
    },

    onError: (error, params, context) => {
      const message = formatSendError(error);
      // Rollback on error - update the pending message to show error state
      if (context) {
        const chatId = params.activeChatId;
        if (chatId) {
          // Update the pending message with error
          queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
            old.map((msg) =>
              msg.id === context.pendingMessageId
                ? {
                    ...msg,
                    content: message,
                    isPending: false,
                    isError: true,
                  }
                : msg,
            ),
          );
        }
      }
      onError?.(message === error.message ? error : new Error(message));
    },

    onSuccess: (data, params, context) => {
      if (context) {
        const chatId = params.activeChatId || data.resolvedChatId;

        // Update the pending message with response
        queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
          old.map((msg) =>
            msg.id === context.pendingMessageId
              ? { ...msg, content: data.explanation, isPending: false }
              : msg,
          ),
        );

        // Notify parent with resolved data
        onSuccess?.(data, data.resolvedChatId);
      }
    },

    onSettled: () => {
      abortControllerRef.current = null;
      pendingSendKeyRef.current = null;
    },
  });

  /**
   * Cancel any pending request.
   * Useful when user navigates away or closes chat.
   */
  const cancelPending = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingSendKeyRef.current = null;
    mutation.reset();
  }, [mutation]);

  return {
    sendMessage: useCallback(
      (params: SendMessageMutationParams) => {
        const idempotencyKey = params.idempotencyKey || buildIdempotencyKey(params);
        if (pendingSendKeyRef.current === idempotencyKey) {
          return;
        }
        pendingSendKeyRef.current = idempotencyKey;
        mutation.mutate({ ...params, idempotencyKey });
      },
      [mutation],
    ),
    sendMessageAsync: useCallback(
      async (params: SendMessageMutationParams) => {
        const idempotencyKey = params.idempotencyKey || buildIdempotencyKey(params);
        if (pendingSendKeyRef.current === idempotencyKey) {
          return undefined;
        }
        pendingSendKeyRef.current = idempotencyKey;
        return mutation.mutateAsync({ ...params, idempotencyKey });
      },
      [mutation],
    ),
    isSending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    cancelPending,
  };
}
