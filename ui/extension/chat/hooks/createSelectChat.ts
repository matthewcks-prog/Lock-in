import type { ChatHistoryItem, ChatMessage, UseChatOptions } from '../types';
import { normalizeChatMessage } from '../types';
import type { Dispatch, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { chatMessagesKeys } from './useChatMessages';

type SetActiveId = Dispatch<SetStateAction<string | null>>;
type SetError = Dispatch<SetStateAction<Error | null>>;
type SetMessages = (chatId: string, messages: ChatMessage[]) => void;
type CancelStream = () => void;

interface SelectChatDeps {
  apiClient: UseChatOptions['apiClient'];
  queryClient: QueryClient;
  setActiveChatId: SetActiveId;
  setActiveHistoryId: SetActiveId;
  setError: SetError;
  setMessages: SetMessages;
  cancelStream?: CancelStream;
  currentChatId: string | null;
}

export function createSelectChat(deps: SelectChatDeps) {
  return async (item: ChatHistoryItem) => {
    if (deps.apiClient?.getChatMessages === undefined) return;

    // 1. Cancel any active streams first
    if (deps.cancelStream !== undefined) {
      deps.cancelStream();
    }

    // 2. Cancel any pending queries for the current chat
    if (deps.currentChatId !== null) {
      await deps.queryClient.cancelQueries({
        queryKey: chatMessagesKeys.byId(deps.currentChatId),
      });
    }

    // 3. Reset error state
    deps.setError(null);

    // 4. Set transitional state (history ID first to indicate selection)
    deps.setActiveHistoryId(item.id);

    try {
      // 5. Load messages from API
      const response = await deps.apiClient.getChatMessages(item.id);

      if (!Array.isArray(response)) {
        throw new Error('Invalid response from getChatMessages');
      }

      // 6. Normalize messages
      const normalized: ChatMessage[] = response.map((msg) => normalizeChatMessage(msg));

      // 7. Update cache atomically
      deps.setMessages(item.id, normalized);

      // 8. Commit selection (set active chat ID)
      deps.setActiveChatId(item.id);
    } catch (err: unknown) {
      // Rollback selection on error
      deps.setActiveHistoryId(deps.currentChatId);
      deps.setActiveChatId(deps.currentChatId);

      const error = err instanceof Error ? err : new Error('Failed to load chat messages');
      deps.setError(error);

      // Don't throw - let error state be displayed in UI
    }
  };
}
