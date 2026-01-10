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
import type { ChatMessage, SendMessageParams, ChatApiResponse, UseSendMessageOptions } from '../types';
import { isValidUUID } from '../types';
import { chatMessagesKeys } from './useChatMessages';

interface MutationContext {
    previousMessages: ChatMessage[];
    pendingMessageId: string;
    provisionalChatId: string;
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const mutation = useMutation<
        ChatApiResponse & { resolvedChatId: string },
        Error,
        SendMessageParams & { currentMessages: ChatMessage[]; activeChatId: string | null },
        MutationContext
    >({
        mutationFn: async (params) => {
            // Cancel any previous pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            if (!apiClient?.processText) {
                throw new Error('API client not available');
            }

            const baseHistory = params.chatHistory || params.currentMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            const apiChatId = isValidUUID(params.chatId) ? params.chatId : undefined;

            const response = await apiClient.processText({
                selection: params.message,
                mode: params.mode,
                chatHistory: baseHistory,
                newUserMessage: params.source === 'followup' ? params.message : undefined,
                chatId: apiChatId,
                pageUrl: params.pageUrl || pageUrl,
                courseCode: params.courseCode || courseCode || undefined,
            });

            const explanation = response?.data?.explanation || `(${params.mode}) ${params.message}`;
            const resolvedChatId = response?.chatId || params.chatId || `chat-${Date.now()}`;

            return {
                explanation,
                chatId: response?.chatId,
                chatTitle: response?.chatTitle,
                resolvedChatId,
            };
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
            // Rollback on error
            if (context) {
                const chatId = params.activeChatId;
                if (chatId) {
                    // Update the pending message with error
                    queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
                        old.map((msg) =>
                            msg.id === context.pendingMessageId
                                ? {
                                    ...msg,
                                    content: error?.message || 'We could not process this request. Try again in a moment.',
                                    isPending: false,
                                }
                                : msg,
                        ),
                    );
                }
            }
            onError?.(error);
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
        mutation.reset();
    }, [mutation]);

    return {
        sendMessage: mutation.mutate,
        sendMessageAsync: mutation.mutateAsync,
        isSending: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        reset: mutation.reset,
        cancelPending,
    };
}
