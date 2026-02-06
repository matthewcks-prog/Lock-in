import type { QueryClient } from '@tanstack/react-query';
import type { ChatApiResponse, ChatMessage } from '../types';
import { chatMessagesKeys } from './useChatMessages';
import { formatSendError, type SendMessageMutationParams } from './sendMessageUtils';

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

export function createSendMessageHandlers(deps: MutationHandlerDeps) {
  const onMutate = async (params: SendMessageMutationParams): Promise<MutationContext> => {
    const chatId = params.activeChatId;
    if (chatId) {
      await deps.queryClient.cancelQueries({ queryKey: chatMessagesKeys.byId(chatId) });
    }

    const previousMessages = chatId
      ? deps.queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId)) || []
      : params.currentMessages;

    const pendingMessageId = `assistant-${Date.now()}`;
    const provisionalChatId = chatId || `chat-${Date.now()}`;

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
      deps.queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), updatedMessages);
    }

    return {
      previousMessages,
      pendingMessageId,
      provisionalChatId,
    };
  };

  const onError = (error: Error, params: SendMessageMutationParams, context?: MutationContext) => {
    const message = formatSendError(error);
    if (context) {
      const chatId = params.activeChatId;
      if (chatId) {
        deps.queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
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
    deps.onError?.(message === error.message ? error : new Error(message));
  };

  const onSuccess = (
    data: ChatApiResponse & { resolvedChatId: string },
    params: SendMessageMutationParams,
    context?: MutationContext,
  ) => {
    if (context) {
      const chatId = params.activeChatId || data.resolvedChatId;

      deps.queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (old = []) =>
        old.map((msg) =>
          msg.id === context.pendingMessageId
            ? { ...msg, content: data.explanation, isPending: false }
            : msg,
        ),
      );

      deps.onSuccess?.(data, data.resolvedChatId);
    }
  };

  return { onMutate, onError, onSuccess };
}
