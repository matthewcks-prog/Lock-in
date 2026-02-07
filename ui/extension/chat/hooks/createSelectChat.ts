import type { ChatHistoryItem, ChatMessage, UseChatOptions } from '../types';
import { normalizeChatMessage } from '../types';
import type { Dispatch, SetStateAction } from 'react';

type SetActiveId = Dispatch<SetStateAction<string | null>>;
type SetError = Dispatch<SetStateAction<Error | null>>;
type SetMessages = (chatId: string, messages: ChatMessage[]) => void;

interface SelectChatDeps {
  apiClient: UseChatOptions['apiClient'];
  setActiveChatId: SetActiveId;
  setActiveHistoryId: SetActiveId;
  setError: SetError;
  setMessages: SetMessages;
}

export function createSelectChat(deps: SelectChatDeps) {
  return async (item: ChatHistoryItem) => {
    if (!deps.apiClient?.getChatMessages) return;

    deps.setError(null);
    deps.setActiveHistoryId(item.id);
    deps.setActiveChatId(item.id);

    try {
      const response = await deps.apiClient.getChatMessages(item.id);
      if (Array.isArray(response)) {
        const normalized: ChatMessage[] = response.map((msg) => normalizeChatMessage(msg));
        deps.setMessages(item.id, normalized);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to load chat messages');
      deps.setError(error);
    }
  };
}
