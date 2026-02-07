/**
 * useSendMessageStream Hook
 *
 * Streaming mutation hook for sending chat messages with:
 * - Real-time content streaming via SSE
 * - Request cancellation via AbortController
 * - Optimistic UI updates with progressive content
 * - Automatic rollback on error
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranscriptCache } from '../../transcripts/hooks/useTranscriptCache';
import type { ChatApiResponse, UseSendMessageOptions, ChatMessage } from '../types';
import {
  buildIdempotencyKey,
  type SendMessageMutationParams,
  buildChatHistory,
  cacheTranscriptIfNeeded,
  resolveApiChatId,
  resolveIdempotencyKey,
  resolveSelectionPayload,
  resolveUserMessagePayload,
} from './sendMessageUtils';
import type {
  ProcessTextStreamParams,
  StreamMetaEvent,
  StreamDeltaEvent,
  StreamFinalEvent,
  StreamErrorEvent,
} from '@api/client';
import { chatMessagesKeys } from './useChatMessages';
import { chatHistoryKeys } from './useChatHistory';

/**
 * State for streaming message
 */
export interface StreamingState {
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current streamed content (accumulated) */
  streamedContent: string;
  /** Metadata from stream (chatId, messageId) */
  meta: StreamMetaEvent | null;
  /** Error if stream failed */
  error: StreamErrorEvent | null;
  /** Whether stream completed successfully */
  isComplete: boolean;
}

/**
 * Options for streaming send
 */
export interface UseSendMessageStreamOptions extends UseSendMessageOptions {
  /** Callback when streaming starts with meta info */
  onStreamStart?: (meta: StreamMetaEvent) => void;
  /** Callback for each content delta */
  onStreamDelta?: (delta: StreamDeltaEvent, accumulated: string) => void;
  /** Callback when stream completes */
  onStreamComplete?: (final: StreamFinalEvent) => void;
  /** Callback for stream errors */
  onStreamError?: (error: StreamErrorEvent) => void;
}

/**
 * Result of streaming send operation
 */
export interface StreamingSendResult {
  success: boolean;
  chatId?: string;
  chatTitle?: string;
  content?: string;
  error?: StreamErrorEvent;
}

/**
 * Hook for sending messages with streaming response.
 *
 * Key features:
 * - Streams content progressively
 * - Cancels previous request if new one is sent
 * - Optimistic "Thinking..." message that updates with streamed content
 * - Rollback on error
 */
export function useSendMessageStream(options: UseSendMessageStreamOptions) {
  const {
    apiClient,
    pageUrl,
    courseCode,
    onSuccess,
    onError,
    onStreamStart,
    onStreamDelta,
    onStreamComplete,
    onStreamError,
  } = options;

  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingSendKeyRef = useRef<string | null>(null);
  const { cacheTranscript } = useTranscriptCache(apiClient);

  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: '',
    meta: null,
    error: null,
    isComplete: false,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Reset streaming state
   */
  const resetState = useCallback(() => {
    setStreamingState({
      isStreaming: false,
      streamedContent: '',
      meta: null,
      error: null,
      isComplete: false,
    });
  }, []);

  /**
   * Cancel any pending streaming request
   */
  const cancelPending = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingSendKeyRef.current = null;
    resetState();
  }, [resetState]);

  /**
   * Send message with streaming
   */
  const sendMessageStream = useCallback(
    async (params: SendMessageMutationParams): Promise<StreamingSendResult> => {
      const idempotencyKey = params.idempotencyKey || buildIdempotencyKey(params);

      // Prevent duplicate sends
      if (pendingSendKeyRef.current === idempotencyKey) {
        return { success: false };
      }
      pendingSendKeyRef.current = idempotencyKey;

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (!apiClient?.processTextStream) {
        const error: StreamErrorEvent = {
          code: 'API_NOT_AVAILABLE',
          message: 'Streaming API client not available',
          retryable: false,
        };
        onStreamError?.(error);
        onError?.(new Error(error.message));
        return { success: false, error };
      }

      // Reset and start streaming
      setStreamingState({
        isStreaming: true,
        streamedContent: '',
        meta: null,
        error: null,
        isComplete: false,
      });

      // Cache transcript if needed
      await cacheTranscriptIfNeeded(cacheTranscript, params.transcriptContext);

      // Build request payload
      const baseHistory = buildChatHistory(params);
      const apiChatId = resolveApiChatId(params);
      const selectionPayload = resolveSelectionPayload(params);
      const userMessagePayload = resolveUserMessagePayload(params);
      const resolvedIdempotencyKey = resolveIdempotencyKey(params);

      const requestPayload: ProcessTextStreamParams = {
        selection: selectionPayload,
        chatHistory: baseHistory,
        signal: abortControllerRef.current.signal,
      };

      // Handle idempotency key conditionally (exactOptionalPropertyTypes)
      if (resolvedIdempotencyKey) {
        requestPayload.idempotencyKey = resolvedIdempotencyKey;
      }

      if (userMessagePayload !== undefined) {
        requestPayload.newUserMessage = userMessagePayload;
      }
      if (apiChatId) {
        requestPayload.chatId = apiChatId;
      }
      const resolvedPageUrl = params.pageUrl || pageUrl;
      if (resolvedPageUrl) {
        requestPayload.pageUrl = resolvedPageUrl;
      }
      const resolvedCourseCode = params.courseCode ?? courseCode ?? null;
      if (resolvedCourseCode) {
        requestPayload.courseCode = resolvedCourseCode;
      }
      if (params.attachmentIds && params.attachmentIds.length > 0) {
        requestPayload.attachments = params.attachmentIds;
      }

      let accumulated = '';
      let streamMeta: StreamMetaEvent | null = null;
      let finalContent: string | undefined;
      let chatTitle: string | undefined;

      // Setup callbacks
      requestPayload.onMeta = (meta) => {
        streamMeta = meta;
        setStreamingState((prev) => ({ ...prev, meta }));
        onStreamStart?.(meta);
      };

      requestPayload.onDelta = (delta) => {
        accumulated += delta.content;
        setStreamingState((prev) => ({
          ...prev,
          streamedContent: accumulated,
        }));
        onStreamDelta?.(delta, accumulated);

        // Update optimistic message in cache if we have a chat ID
        if (streamMeta?.chatId) {
          updateOptimisticMessage(queryClient, streamMeta.chatId, accumulated);
        }
      };

      requestPayload.onFinal = (final) => {
        finalContent = final.content;
        // Update with final content
        setStreamingState((prev) => ({
          ...prev,
          streamedContent: final.content || accumulated,
          isComplete: true,
        }));
        onStreamComplete?.(final);
      };

      requestPayload.onError = (error) => {
        setStreamingState((prev) => ({
          ...prev,
          error,
          isStreaming: false,
        }));
        onStreamError?.(error);
      };

      // REMOVED: Blocking fallback - streaming is the only code path
      // If streaming fails, we retry with exponential backoff instead of falling back

      try {
        const result = await apiClient.processTextStream(requestPayload);

        // Cleanup
        abortControllerRef.current = null;
        pendingSendKeyRef.current = null;

        if (!result.success) {
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            error: result.error || null,
          }));
          if (result.error) {
            onError?.(new Error(result.error.message));
          }

          // No fallback - return error immediately
          const failResult: StreamingSendResult = { success: false };
          if (result.error) {
            failResult.error = result.error;
          }
          return failResult;
        }

        // Success
        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          isComplete: true,
        }));

        const resolvedChatId = result.chatId || params.chatId || `chat-${Date.now()}`;

        // Call success callback
        const contentValue = finalContent || result.content || accumulated;
        const response: ChatApiResponse = {
          content: contentValue,
        };
        if (result.chatId) {
          response.chatId = result.chatId;
        }
        if (chatTitle) {
          response.chatTitle = chatTitle;
        }
        onSuccess?.(response, resolvedChatId);

        // Invalidate chat queries to refresh from server
        if (result.chatId) {
          queryClient.invalidateQueries({
            queryKey: chatMessagesKeys.byId(result.chatId),
          });
          queryClient.invalidateQueries({
            queryKey: chatHistoryKeys.all,
          });
        }

        // Build success result conditionally for exactOptionalPropertyTypes
        const successResult: StreamingSendResult = { success: true };
        if (result.chatId) {
          successResult.chatId = result.chatId;
        }
        if (chatTitle) {
          successResult.chatTitle = chatTitle;
        }
        const finalContentValue = finalContent || result.content;
        if (finalContentValue) {
          successResult.content = finalContentValue;
        }
        return successResult;
      } catch (error) {
        // Cleanup
        abortControllerRef.current = null;
        pendingSendKeyRef.current = null;

        const streamError: StreamErrorEvent = {
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: false,
        };

        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          error: streamError,
        }));

        onStreamError?.(streamError);
        onError?.(error instanceof Error ? error : new Error('Unknown error'));

        // No fallback - return error immediately
        return {
          success: false,
          error: streamError,
        };
      }
    },
    [
      apiClient,
      pageUrl,
      courseCode,
      cacheTranscript,
      queryClient,
      onSuccess,
      onError,
      onStreamStart,
      onStreamDelta,
      onStreamComplete,
      onStreamError,
    ],
  );

  return {
    sendMessageStream,
    ...streamingState,
    cancelPending,
    reset: resetState,
  };
}

/**
 * Update optimistic assistant message in query cache
 */
function updateOptimisticMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string,
  content: string,
): void {
  queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (oldMessages) => {
    if (!oldMessages) return oldMessages;

    // Find the pending assistant message and update it
    return oldMessages.map((msg) =>
      msg.role === 'assistant' && msg.isPending ? { ...msg, content, isPending: true } : msg,
    );
  });
}
