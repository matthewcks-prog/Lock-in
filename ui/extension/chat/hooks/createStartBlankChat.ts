import type { ChatHistoryItem, ChatMessage, HistoryTitleSource } from '../types';
import { FALLBACK_CHAT_TITLE } from '../types';
import type { Dispatch, SetStateAction } from 'react';

type SetMessages = (chatId: string, messages: ChatMessage[]) => void;
type UpsertHistory = (
  item: ChatHistoryItem,
  previousId?: string | null,
  titleSource?: HistoryTitleSource,
) => void;

type SetActiveId = Dispatch<SetStateAction<string | null>>;
type SetError = Dispatch<SetStateAction<Error | null>>;
type SetHistoryOpen = Dispatch<SetStateAction<boolean>>;

interface StartBlankChatDeps {
  setMessages: SetMessages;
  upsertHistory: UpsertHistory;
  setActiveChatId: SetActiveId;
  setActiveHistoryId: SetActiveId;
  setIsHistoryOpen: SetHistoryOpen;
  setError: SetError;
}

export function createStartBlankChat(deps: StartBlankChatDeps) {
  return () => {
    const now = new Date().toISOString();
    const provisionalChatId = `chat-${Date.now()}`;

    deps.setIsHistoryOpen(false);
    deps.setError(null);
    deps.setActiveChatId(provisionalChatId);
    deps.setActiveHistoryId(provisionalChatId);

    deps.setMessages(provisionalChatId, []);

    deps.upsertHistory(
      {
        id: provisionalChatId,
        title: FALLBACK_CHAT_TITLE,
        updatedAt: now,
        lastMessage: '',
      },
      undefined,
      'local',
    );
  };
}
