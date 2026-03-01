import { useQueryClient } from '@tanstack/react-query';
import type { UseChatOptions } from '../types';
import { createChatReturn, type CreateChatReturnParams } from './createChatReturn';
import { useChatActions, type UseChatActionsParams } from './useChatActions';
import { useChatHistory } from './useChatHistory';
import { useChatMessages } from './useChatMessages';
import type { UseChatReturn } from './chatHookTypes';
import { useChatRegenerationMutations } from './useChatMutations';
import { useChatSenders, type UseChatSendersParams } from './useChatSenders';
import { useChatSessionState } from './useChatSessionState';

function buildSendersParams({
  apiClient,
  pageUrl,
  courseCode,
  enableStreaming,
  queryClient,
  session,
  upsertHistory,
}: {
  apiClient: UseChatOptions['apiClient'];
  pageUrl: string;
  courseCode: string | null;
  enableStreaming: boolean | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  session: ReturnType<typeof useChatSessionState>;
  upsertHistory: ReturnType<typeof useChatHistory>['upsertHistory'];
}): UseChatSendersParams {
  return {
    apiClient,
    pageUrl,
    courseCode,
    enableStreaming,
    queryClient,
    activeChatIdRef: session.activeChatIdRef,
    activeHistoryIdRef: session.activeHistoryIdRef,
    setActiveChatId: session.setActiveChatId,
    setActiveHistoryId: session.setActiveHistoryId,
    setError: session.setError,
    upsertHistory,
  };
}

function buildActionsParams({
  apiClient,
  pageUrl,
  courseCode,
  queryClient,
  session,
  messagesState,
  upsertHistory,
  sendMessageMutation,
  cancelStream,
}: {
  apiClient: UseChatOptions['apiClient'];
  pageUrl: string;
  courseCode: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
  session: ReturnType<typeof useChatSessionState>;
  messagesState: ReturnType<typeof useChatMessages>;
  upsertHistory: ReturnType<typeof useChatHistory>['upsertHistory'];
  sendMessageMutation: ReturnType<typeof useChatSenders>['sendMessageMutation'];
  cancelStream: () => void;
}): UseChatActionsParams {
  return {
    apiClient,
    pageUrl,
    courseCode,
    queryClient,
    activeChatId: session.activeChatId,
    activeHistoryId: session.activeHistoryId,
    messages: messagesState.messages,
    setMessages: messagesState.setMessages,
    upsertHistory,
    sendMessageMutation,
    setActiveChatId: session.setActiveChatId,
    setActiveHistoryId: session.setActiveHistoryId,
    setIsHistoryOpen: session.setIsHistoryOpen,
    setError: session.setError,
    cancelStream,
  };
}

function buildReturnParams({
  enableStreaming,
  session,
  messagesState,
  historyState,
  actions,
  senders,
  mutations,
}: {
  enableStreaming: boolean | undefined;
  session: ReturnType<typeof useChatSessionState>;
  messagesState: ReturnType<typeof useChatMessages>;
  historyState: ReturnType<typeof useChatHistory>;
  actions: ReturnType<typeof useChatActions>;
  senders: ReturnType<typeof useChatSenders>;
  mutations: ReturnType<typeof useChatRegenerationMutations>;
}): CreateChatReturnParams {
  return { enableStreaming, session, messagesState, historyState, actions, senders, mutations };
}

function resolveChatReturn({
  enableStreaming,
  session,
  messagesState,
  historyState,
  actions,
  senders,
  mutations,
}: {
  enableStreaming: boolean | undefined;
  session: ReturnType<typeof useChatSessionState>;
  messagesState: ReturnType<typeof useChatMessages>;
  historyState: ReturnType<typeof useChatHistory>;
  actions: ReturnType<typeof useChatActions>;
  senders: ReturnType<typeof useChatSenders>;
  mutations: ReturnType<typeof useChatRegenerationMutations>;
}): UseChatReturn {
  return createChatReturn(
    buildReturnParams({
      enableStreaming,
      session,
      messagesState,
      historyState,
      actions,
      senders,
      mutations,
    }),
  );
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { apiClient, storage, pageUrl, courseCode, enableStreaming } = options;
  const queryClient = useQueryClient();
  const session = useChatSessionState({ apiClient, storage });
  const messagesState = useChatMessages({ apiClient, chatId: session.activeChatId });
  const historyState = useChatHistory({ apiClient });
  const senders = useChatSenders(
    buildSendersParams({
      apiClient,
      pageUrl,
      courseCode,
      enableStreaming,
      queryClient,
      session,
      upsertHistory: historyState.upsertHistory,
    }),
  );
  const actions = useChatActions(
    buildActionsParams({
      apiClient,
      pageUrl,
      courseCode,
      queryClient,
      session,
      messagesState,
      upsertHistory: historyState.upsertHistory,
      sendMessageMutation: senders.sendMessageMutation,
      cancelStream: senders.cancelStream,
    }),
  );
  const mutations = useChatRegenerationMutations({
    apiClient,
    activeChatId: session.activeChatId,
    pageUrl,
    courseCode,
    enableStreaming,
    sendMessageMutation: senders.sendMessageMutation,
    sendMessageStream: senders.sendMessageStream,
    cancelStream: senders.cancelStream,
  });
  return resolveChatReturn({
    enableStreaming,
    session,
    messagesState,
    historyState,
    actions,
    senders,
    mutations,
  });
}
