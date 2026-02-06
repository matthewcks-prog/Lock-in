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
import { useTranscriptCache } from '../../transcripts/hooks/useTranscriptCache';
import type { ChatApiResponse, UseSendMessageOptions } from '../types';
import { buildIdempotencyKey, type SendMessageMutationParams } from './sendMessageUtils';
import { sendMessageMutation } from './sendMessageMutation';
import {
  createSendMessageHandlers,
  type MutationContext,
  type MutationHandlerDeps,
} from './sendMessageHandlers';

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

  const handlerDeps: MutationHandlerDeps = { queryClient };
  if (onSuccess) {
    handlerDeps.onSuccess = onSuccess;
  }
  if (onError) {
    handlerDeps.onError = onError;
  }

  const {
    onMutate,
    onError: handleError,
    onSuccess: handleSuccess,
  } = createSendMessageHandlers(handlerDeps);

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
    onMutate,
    onError: handleError,
    onSuccess: handleSuccess,

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
