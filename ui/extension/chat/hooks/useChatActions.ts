import type { QueryClient } from '@tanstack/react-query';
import type { UseChatOptions } from '../types';
import { createSelectChat } from './createSelectChat';
import { createSendMessage } from './createSendMessage';
import { createStartBlankChat } from './createStartBlankChat';
import { createStartNewChat } from './createStartNewChat';
import type { UseChatReturn } from './chatHookTypes';
import type { useChatHistory } from './useChatHistory';
import type { useChatMessages } from './useChatMessages';
import type { useChatSessionState } from './useChatSessionState';
import type { useSendMessage } from './useSendMessage';

type SessionState = ReturnType<typeof useChatSessionState>;
type MessagesState = ReturnType<typeof useChatMessages>;
type HistoryState = ReturnType<typeof useChatHistory>;
type BlockingSendState = ReturnType<typeof useSendMessage>;

interface PrimaryActions {
  startNewChat: UseChatReturn['startNewChat'];
  startBlankChat: UseChatReturn['startBlankChat'];
  selectChat: UseChatReturn['selectChat'];
}

export interface ChatActions extends PrimaryActions {
  sendMessage: UseChatReturn['sendMessage'];
}

interface PrimaryActionsParams {
  apiClient: UseChatOptions['apiClient'];
  pageUrl: string;
  courseCode: string | null;
  setMessages: MessagesState['setMessages'];
  upsertHistory: HistoryState['upsertHistory'];
  sendMessageMutation: BlockingSendState['sendMessage'];
  setActiveChatId: SessionState['setActiveChatId'];
  setActiveHistoryId: SessionState['setActiveHistoryId'];
  setIsHistoryOpen: SessionState['setIsHistoryOpen'];
  setError: SessionState['setError'];
}

interface SendMessageActionParams {
  activeChatId: SessionState['activeChatId'];
  activeHistoryId: SessionState['activeHistoryId'];
  messages: MessagesState['messages'];
  pageUrl: string;
  courseCode: string | null;
  queryClient: QueryClient;
  upsertHistory: HistoryState['upsertHistory'];
  sendMessageMutation: BlockingSendState['sendMessage'];
  startNewChat: UseChatReturn['startNewChat'];
  setActiveHistoryId: SessionState['setActiveHistoryId'];
  setIsHistoryOpen: SessionState['setIsHistoryOpen'];
  setError: SessionState['setError'];
}

export interface UseChatActionsParams extends PrimaryActionsParams {
  queryClient: QueryClient;
  activeChatId: SessionState['activeChatId'];
  activeHistoryId: SessionState['activeHistoryId'];
  messages: MessagesState['messages'];
}

function createPrimaryActions(params: PrimaryActionsParams): PrimaryActions {
  const {
    apiClient,
    pageUrl,
    courseCode,
    setMessages,
    upsertHistory,
    sendMessageMutation,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  } = params;
  const startNewChat = createStartNewChat({
    pageUrl,
    courseCode,
    setMessages,
    upsertHistory,
    sendMessage: sendMessageMutation,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });
  const startBlankChat = createStartBlankChat({
    setMessages,
    upsertHistory,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });
  const selectChat = createSelectChat({
    apiClient,
    setActiveChatId,
    setActiveHistoryId,
    setError,
    setMessages,
  });

  return { startNewChat, startBlankChat, selectChat };
}

function createSendMessageAction(params: SendMessageActionParams): UseChatReturn['sendMessage'] {
  const {
    activeChatId,
    activeHistoryId,
    messages,
    pageUrl,
    courseCode,
    queryClient,
    upsertHistory,
    sendMessageMutation,
    startNewChat,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  } = params;
  return createSendMessage({
    activeChatId,
    activeHistoryId,
    messages,
    pageUrl,
    courseCode,
    queryClient,
    upsertHistory,
    sendMessage: sendMessageMutation,
    startNewChat,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });
}

export function useChatActions(params: UseChatActionsParams): ChatActions {
  const {
    apiClient,
    pageUrl,
    courseCode,
    queryClient,
    activeChatId,
    activeHistoryId,
    messages,
    setMessages,
    upsertHistory,
    sendMessageMutation,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  } = params;
  const primary = createPrimaryActions({
    apiClient,
    pageUrl,
    courseCode,
    setMessages,
    upsertHistory,
    sendMessageMutation,
    setActiveChatId,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });
  const sendMessage = createSendMessageAction({
    activeChatId,
    activeHistoryId,
    messages,
    pageUrl,
    courseCode,
    queryClient,
    upsertHistory,
    sendMessageMutation,
    startNewChat: primary.startNewChat,
    setActiveHistoryId,
    setIsHistoryOpen,
    setError,
  });

  return { sendMessage, ...primary };
}
