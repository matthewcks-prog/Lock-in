import type { UseChatOptions, ChatMessage } from '../types';
import type { UseChatReturn } from './chatHookTypes';
import type { SendMessageMutationParams } from './sendMessageUtils';
import type { useSendMessage } from './useSendMessage';
import type { useSendMessageStream } from './useSendMessageStream';
import { useMessageEdit } from './useMessageEdit';
import { useRegenerateMessage } from './useRegenerateMessage';

type BlockingSendState = ReturnType<typeof useSendMessage>;
type StreamingSendState = ReturnType<typeof useSendMessageStream>;

export type DispatchRegeneration = (canonicalMessages: ChatMessage[], chatId: string) => void;

export interface ChatMutations {
  messageEdit: UseChatReturn['messageEdit'];
  regeneration: UseChatReturn['regeneration'];
}

function hasValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function findLastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return [...messages].reverse().find((message) => message.role === 'user');
}

export function createDispatchRegeneration({
  pageUrl,
  courseCode,
  enableStreaming,
  sendMessageMutation,
  sendMessageStream,
}: {
  pageUrl: string;
  courseCode: string | null;
  enableStreaming: boolean | undefined;
  sendMessageMutation: BlockingSendState['sendMessage'];
  sendMessageStream: StreamingSendState['sendMessageStream'];
}): DispatchRegeneration {
  return (canonicalMessages: ChatMessage[], chatId: string) => {
    const lastUserMessage = findLastUserMessage(canonicalMessages);
    if (lastUserMessage === undefined) return;

    const payload: SendMessageMutationParams = {
      message: lastUserMessage.content,
      source: 'followup',
      pageUrl,
      chatId,
      currentMessages: canonicalMessages,
      activeChatId: chatId,
    };
    if (hasValue(courseCode)) {
      payload.courseCode = courseCode;
    }
    if (enableStreaming === true) {
      void sendMessageStream(payload);
      return;
    }
    sendMessageMutation(payload);
  };
}

export function useChatMutations({
  apiClient,
  activeChatId,
  cancelStream,
  dispatchRegeneration,
}: {
  apiClient: UseChatOptions['apiClient'];
  activeChatId: string | null;
  cancelStream: StreamingSendState['cancelPending'];
  dispatchRegeneration: DispatchRegeneration;
}): ChatMutations {
  const triggerRegeneration = (canonicalMessages: ChatMessage[]): void => {
    if (!hasValue(activeChatId)) return;
    dispatchRegeneration(canonicalMessages, activeChatId);
  };

  const messageEdit = useMessageEdit({
    apiClient,
    chatId: activeChatId,
    cancelStream,
    onEditComplete: (_editedContent, canonicalMessages) => {
      triggerRegeneration(canonicalMessages);
    },
  });
  const regeneration = useRegenerateMessage({
    apiClient,
    chatId: activeChatId,
    cancelStream,
    onRegenerateReady: triggerRegeneration,
  });

  return { messageEdit, regeneration };
}

export function useChatRegenerationMutations({
  apiClient,
  activeChatId,
  pageUrl,
  courseCode,
  enableStreaming,
  sendMessageMutation,
  sendMessageStream,
  cancelStream,
}: {
  apiClient: UseChatOptions['apiClient'];
  activeChatId: string | null;
  pageUrl: string;
  courseCode: string | null;
  enableStreaming: boolean | undefined;
  sendMessageMutation: BlockingSendState['sendMessage'];
  sendMessageStream: StreamingSendState['sendMessageStream'];
  cancelStream: StreamingSendState['cancelPending'];
}): ChatMutations {
  const dispatchRegeneration = createDispatchRegeneration({
    pageUrl,
    courseCode,
    enableStreaming,
    sendMessageMutation,
    sendMessageStream,
  });
  return useChatMutations({ apiClient, activeChatId, cancelStream, dispatchRegeneration });
}
