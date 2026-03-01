import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ChatApiResponse, ChatHistoryItem, ChatMessage, HistoryTitleSource } from '../types';
import { buildInitialChatTitle, coerceChatTitle } from '../types';
import { chatMessagesKeys } from './useChatMessages';

const CHAT_TITLE_PREVIEW_CHARS = 50;

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
    const activeChatId = deps.activeChatIdRef.current;
    const activeHistoryId = deps.activeHistoryIdRef.current;
    const previousChatId =
      activeChatId !== null && activeChatId.length > 0
        ? activeChatId
        : activeHistoryId !== null && activeHistoryId.length > 0
          ? activeHistoryId
          : null;
    if (previousChatId !== null && previousChatId !== resolvedChatId) {
      const cachedMessages = deps.queryClient.getQueryData<ChatMessage[]>(
        chatMessagesKeys.byId(previousChatId),
      );
      if (cachedMessages !== undefined && cachedMessages.length > 0) {
        deps.queryClient.setQueryData(chatMessagesKeys.byId(resolvedChatId), cachedMessages);
      }
    }
    const fallbackTitle = buildInitialChatTitle(
      response.content.slice(0, CHAT_TITLE_PREVIEW_CHARS),
    );
    const serverTitle = response.chatTitle;
    const hasServerTitle =
      serverTitle !== null && serverTitle !== undefined && serverTitle.length > 0;
    const resolvedTitle = hasServerTitle
      ? coerceChatTitle(serverTitle, fallbackTitle)
      : fallbackTitle;
    const titleSource: HistoryTitleSource = hasServerTitle ? 'server' : 'local';

    deps.setActiveChatId(resolvedChatId);
    deps.setActiveHistoryId(resolvedChatId);

    deps.upsertHistory(
      {
        id: resolvedChatId,
        title: resolvedTitle,
        updatedAt: now,
        lastMessage: response.content,
      },
      deps.activeHistoryIdRef.current !== resolvedChatId
        ? deps.activeHistoryIdRef.current
        : undefined,
      titleSource,
    );
  };
}
