import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ChatApiResponse, ChatHistoryItem, ChatMessage, HistoryTitleSource } from '../types';
import { buildInitialChatTitle, coerceChatTitle } from '../types';
import { chatMessagesKeys } from './useChatMessages';

type UpsertHistory = (
  item: ChatHistoryItem,
  previousId?: string | null,
  titleSource?: HistoryTitleSource,
) => void;

type SetActiveId = Dispatch<SetStateAction<string | null>>;

type ChatIdRef = MutableRefObject<string | null>;

interface SendSuccessDeps {
  queryClient: QueryClient;
  activeChatIdRef: ChatIdRef;
  activeHistoryIdRef: ChatIdRef;
  setActiveChatId: SetActiveId;
  setActiveHistoryId: SetActiveId;
  upsertHistory: UpsertHistory;
}

export function createSendSuccessHandler(deps: SendSuccessDeps) {
  return (response: ChatApiResponse, resolvedChatId: string) => {
    const now = new Date().toISOString();
    const previousChatId = deps.activeChatIdRef.current || deps.activeHistoryIdRef.current;
    if (previousChatId && previousChatId !== resolvedChatId) {
      const cachedMessages = deps.queryClient.getQueryData<ChatMessage[]>(
        chatMessagesKeys.byId(previousChatId),
      );
      if (cachedMessages && cachedMessages.length > 0) {
        deps.queryClient.setQueryData(chatMessagesKeys.byId(resolvedChatId), cachedMessages);
      }
    }
    const fallbackTitle = buildInitialChatTitle(response.explanation.slice(0, 50));
    const serverTitle = response.chatTitle;
    const resolvedTitle = serverTitle ? coerceChatTitle(serverTitle, fallbackTitle) : fallbackTitle;
    const titleSource: HistoryTitleSource = serverTitle ? 'server' : 'local';

    deps.setActiveChatId(resolvedChatId);
    deps.setActiveHistoryId(resolvedChatId);

    deps.upsertHistory(
      {
        id: resolvedChatId,
        title: resolvedTitle,
        updatedAt: now,
        lastMessage: response.explanation,
      },
      deps.activeHistoryIdRef.current !== resolvedChatId
        ? deps.activeHistoryIdRef.current
        : undefined,
      titleSource,
    );
  };
}
