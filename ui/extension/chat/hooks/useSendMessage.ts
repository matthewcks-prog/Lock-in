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
import type { MutableRefObject } from 'react';
import { useTranscriptCache } from '../../transcripts/hooks/useTranscriptCache';
import type { ChatApiResponse, UseSendMessageOptions } from '../types';
import { buildIdempotencyKey, type SendMessageMutationParams } from './sendMessageUtils';
import { sendMessageMutation } from './sendMessageMutation';
import {
  createSendMessageHandlers,
  type MutationContext,
  type MutationHandlerDeps,
} from './sendMessageHandlers';

interface UseSendMessageResult {
  sendMessage: (params: SendMessageMutationParams) => void;
  sendMessageAsync: (
    params: SendMessageMutationParams,
  ) => Promise<(ChatApiResponse & { resolvedChatId: string }) | undefined>;
  isSending: boolean;
  isError: boolean;
  error: Error | null;
  reset: () => void;
  cancelPending: () => void;
}

type SendMutationResponse = ChatApiResponse & { resolvedChatId: string };

interface SendMutationState {
  mutate: (params: SendMessageMutationParams) => void;
  mutateAsync: (params: SendMessageMutationParams) => Promise<SendMutationResponse>;
  reset: () => void;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

function useAbortControllerCleanup(
  abortControllerRef: MutableRefObject<AbortController | null>,
): void {
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [abortControllerRef]);
}

function createMutationHandlerDeps({
  queryClient,
  onSuccess,
  onError,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  onSuccess?: UseSendMessageOptions['onSuccess'];
  onError?: UseSendMessageOptions['onError'];
}): MutationHandlerDeps {
  const handlerDeps: MutationHandlerDeps = { queryClient };
  if (onSuccess !== undefined) {
    handlerDeps.onSuccess = onSuccess;
  }
  if (onError !== undefined) {
    handlerDeps.onError = onError;
  }
  return handlerDeps;
}

function prepareMutationParams({
  params,
  pendingSendKeyRef,
}: {
  params: SendMessageMutationParams;
  pendingSendKeyRef: MutableRefObject<string | null>;
}): SendMessageMutationParams | null {
  const idempotencyKey =
    params.idempotencyKey !== undefined && params.idempotencyKey.length > 0
      ? params.idempotencyKey
      : buildIdempotencyKey(params);
  if (pendingSendKeyRef.current === idempotencyKey) {
    return null;
  }
  pendingSendKeyRef.current = idempotencyKey;
  return { ...params, idempotencyKey };
}

function useSendMessageMutation({
  apiClient,
  pageUrl,
  courseCode,
  cacheTranscript,
  abortControllerRef,
  pendingSendKeyRef,
  handlerDeps,
}: {
  apiClient: UseSendMessageOptions['apiClient'];
  pageUrl: string;
  courseCode: string | null;
  cacheTranscript: ReturnType<typeof useTranscriptCache>['cacheTranscript'];
  abortControllerRef: MutableRefObject<AbortController | null>;
  pendingSendKeyRef: MutableRefObject<string | null>;
  handlerDeps: MutationHandlerDeps;
}): SendMutationState {
  const {
    onMutate,
    onError: handleError,
    onSuccess: handleSuccess,
  } = createSendMessageHandlers(handlerDeps);

  return useMutation<SendMutationResponse, Error, SendMessageMutationParams, MutationContext>({
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
}

function useSendActions({
  mutation,
  pendingSendKeyRef,
}: {
  mutation: SendMutationState;
  pendingSendKeyRef: MutableRefObject<string | null>;
}): Pick<UseSendMessageResult, 'sendMessage' | 'sendMessageAsync'> {
  const sendMessage = useCallback(
    (params: SendMessageMutationParams) => {
      const prepared = prepareMutationParams({ params, pendingSendKeyRef });
      if (prepared === null) return;
      mutation.mutate(prepared);
    },
    [mutation, pendingSendKeyRef],
  );

  const sendMessageAsync = useCallback(
    async (params: SendMessageMutationParams) => {
      const prepared = prepareMutationParams({ params, pendingSendKeyRef });
      if (prepared === null) return undefined;
      return mutation.mutateAsync(prepared);
    },
    [mutation, pendingSendKeyRef],
  );

  return { sendMessage, sendMessageAsync };
}

function useCancelPending({
  abortControllerRef,
  pendingSendKeyRef,
  mutation,
}: {
  abortControllerRef: MutableRefObject<AbortController | null>;
  pendingSendKeyRef: MutableRefObject<string | null>;
  mutation: Pick<SendMutationState, 'reset'>;
}): UseSendMessageResult['cancelPending'] {
  return useCallback(() => {
    if (abortControllerRef.current !== null) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingSendKeyRef.current = null;
    mutation.reset();
  }, [abortControllerRef, mutation, pendingSendKeyRef]);
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
export function useSendMessage(options: UseSendMessageOptions): UseSendMessageResult {
  const { apiClient, pageUrl, courseCode, onSuccess, onError } = options;
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingSendKeyRef = useRef<string | null>(null);
  const { cacheTranscript } = useTranscriptCache(apiClient);
  useAbortControllerCleanup(abortControllerRef);

  const handlerDeps = createMutationHandlerDeps({ queryClient, onSuccess, onError });
  const mutation = useSendMessageMutation({
    apiClient,
    pageUrl,
    courseCode,
    cacheTranscript,
    abortControllerRef,
    pendingSendKeyRef,
    handlerDeps,
  });
  const { sendMessage, sendMessageAsync } = useSendActions({ mutation, pendingSendKeyRef });
  const cancelPending = useCancelPending({ abortControllerRef, pendingSendKeyRef, mutation });

  return {
    sendMessage,
    sendMessageAsync,
    isSending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    cancelPending,
  };
}
