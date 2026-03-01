import type { QueryClient } from '@tanstack/react-query';
import type { ChatApiResponse, ChatMessage } from '../types';
import { chatMessagesKeys } from './useChatMessages';
import { formatSendError, type SendMessageMutationParams } from './sendMessageUtils';

// =============================================================================
// Public Types
// =============================================================================

export interface MutationContext {
  previousMessages: ChatMessage[];
  pendingMessageId: string;
  provisionalChatId: string;
}

export interface MutationHandlerDeps {
  queryClient: QueryClient;
  onSuccess?: (response: ChatApiResponse, chatId: string) => void;
  onError?: (error: Error) => void;
}

export interface MutationHandlers {
  onMutate: (params: SendMessageMutationParams) => Promise<MutationContext>;
  onError: (error: Error, params: SendMessageMutationParams, context?: MutationContext) => void;
  onSuccess: (
    data: ChatApiResponse & { resolvedChatId: string },
    params: SendMessageMutationParams,
    context?: MutationContext,
  ) => void;
}

// =============================================================================
// Cache Helpers (extracted for testability & function-length limit)
// =============================================================================

/** Snapshot existing messages from the query cache for rollback. */
function snapshotPreviousMessages(
  queryClient: QueryClient,
  chatId: string | null,
  currentMessages: ChatMessage[],
): ChatMessage[] {
  if (chatId !== null && chatId.length > 0) {
    return queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId)) ?? [];
  }
  return currentMessages;
}

/** Write an optimistic message list into the query cache. */
function setOptimisticMessages(
  queryClient: QueryClient,
  chatId: string | null,
  messages: ChatMessage[],
): void {
  if (chatId !== null && chatId.length > 0) {
    queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), messages);
  }
}

/** Replace a pending message's content in the cache (error or success). */
function replacePendingMessage(
  queryClient: QueryClient,
  chatId: string,
  pendingMessageId: string,
  patch: Partial<ChatMessage>,
): void {
  queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
    old.map((msg) => (msg.id === pendingMessageId ? { ...msg, ...patch } : msg)),
  );
}

// =============================================================================
// Handler Builders
// =============================================================================

/** Build the optimistic-update handler invoked before the mutation fires. */
function buildOnMutate(
  queryClient: QueryClient,
): (params: SendMessageMutationParams) => Promise<MutationContext> {
  return async (params) => {
    const chatId = params.activeChatId;

    if (chatId !== null && chatId.length > 0) {
      await queryClient.cancelQueries({ queryKey: chatMessagesKeys.byId(chatId) });
    }

    const previousMessages = snapshotPreviousMessages(queryClient, chatId, params.currentMessages);
    const provisionalChatId = chatId !== null && chatId.length > 0 ? chatId : `chat-${Date.now()}`;

    // For regeneration requests, the caller has already injected a pending
    // "Thinking..." message into the cache. Reuse it to avoid duplicates.
    if (params.isRegeneration === true) {
      const existingPending = params.currentMessages.find(
        (m) => m.role === 'assistant' && m.isPending === true,
      );
      return {
        previousMessages,
        pendingMessageId:
          existingPending?.id !== undefined && existingPending.id.length > 0
            ? existingPending.id
            : `assistant-${Date.now()}`,
        provisionalChatId,
      };
    }

    const pendingMessageId = `assistant-${Date.now()}`;
    const pendingMessage: ChatMessage = {
      id: pendingMessageId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date().toISOString(),
      isPending: true,
    };

    setOptimisticMessages(queryClient, chatId, [...params.currentMessages, pendingMessage]);

    return { previousMessages, pendingMessageId, provisionalChatId };
  };
}

/** Build the error handler that rolls back the optimistic update. */
function buildOnError(
  queryClient: QueryClient,
  onErrorCallback?: (error: Error) => void,
): (error: Error, params: SendMessageMutationParams, context?: MutationContext) => void {
  return (error, params, context) => {
    const message = formatSendError(error);

    if (context !== undefined) {
      const chatId = params.activeChatId;
      if (chatId !== null && chatId.length > 0) {
        replacePendingMessage(queryClient, chatId, context.pendingMessageId, {
          content: message,
          isPending: false,
          isError: true,
        });
      }
    }

    onErrorCallback?.(message === error.message ? error : new Error(message));
  };
}

/** Build the success handler that finalises the pending message. */
function buildOnSuccess(
  queryClient: QueryClient,
  onSuccessCallback?: (response: ChatApiResponse, chatId: string) => void,
): (
  data: ChatApiResponse & { resolvedChatId: string },
  params: SendMessageMutationParams,
  context?: MutationContext,
) => void {
  return (data, params, context) => {
    if (context === undefined) return;

    const chatId =
      params.activeChatId !== null && params.activeChatId.length > 0
        ? params.activeChatId
        : data.resolvedChatId;

    replacePendingMessage(queryClient, chatId, context.pendingMessageId, {
      content: data.content,
      isPending: false,
    });

    onSuccessCallback?.(data, data.resolvedChatId);
  };
}

// =============================================================================
// Public Factory
// =============================================================================

export function createSendMessageHandlers(deps: MutationHandlerDeps): MutationHandlers {
  return {
    onMutate: buildOnMutate(deps.queryClient),
    onError: buildOnError(deps.queryClient, deps.onError),
    onSuccess: buildOnSuccess(deps.queryClient, deps.onSuccess),
  };
}
