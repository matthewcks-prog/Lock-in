import type { UseChatReturn } from './chatHookTypes';
import type { useChatHistory } from './useChatHistory';
import type { useChatMessages } from './useChatMessages';
import type { useChatSessionState } from './useChatSessionState';
import type { ChatActions } from './useChatActions';
import type { ChatMutations } from './useChatMutations';
import type { ChatSenders } from './useChatSenders';

type SessionState = ReturnType<typeof useChatSessionState>;
type MessagesState = ReturnType<typeof useChatMessages>;
type HistoryState = ReturnType<typeof useChatHistory>;

interface BaseReturnParams {
  session: Pick<
    SessionState,
    | 'activeChatId'
    | 'activeHistoryId'
    | 'error'
    | 'clearError'
    | 'isHistoryOpen'
    | 'setIsHistoryOpen'
    | 'ensureChatId'
  >;
  messagesState: Pick<MessagesState, 'messages' | 'isLoading'>;
  historyState: Pick<
    HistoryState,
    'recentChats' | 'isLoading' | 'hasMore' | 'isFetchingNextPage' | 'loadMore'
  >;
  actions: ChatActions;
  isSending: boolean;
  mutations: ChatMutations;
}

export interface CreateChatReturnParams extends Omit<BaseReturnParams, 'isSending'> {
  enableStreaming: boolean | undefined;
  senders: Pick<ChatSenders, 'isSending' | 'streaming' | 'cancelStream'>;
}

function createBaseReturn(params: BaseReturnParams): UseChatReturn {
  const { session, messagesState, historyState, actions, isSending, mutations } = params;
  return {
    activeChatId: session.activeChatId,
    activeHistoryId: session.activeHistoryId,
    messages: messagesState.messages,
    isLoadingMessages: messagesState.isLoading,
    recentChats: historyState.recentChats,
    isLoadingHistory: historyState.isLoading,
    hasMoreHistory: historyState.hasMore,
    isLoadingMoreHistory: historyState.isFetchingNextPage,
    loadMoreHistory: historyState.loadMore,
    sendMessage: actions.sendMessage,
    startNewChat: actions.startNewChat,
    startBlankChat: actions.startBlankChat,
    selectChat: actions.selectChat,
    ensureChatId: session.ensureChatId,
    isSending,
    error: session.error,
    clearError: session.clearError,
    isHistoryOpen: session.isHistoryOpen,
    setIsHistoryOpen: session.setIsHistoryOpen,
    messageEdit: mutations.messageEdit,
    regeneration: mutations.regeneration,
  };
}

export function createChatReturn(params: CreateChatReturnParams): UseChatReturn {
  const { enableStreaming, session, messagesState, historyState, actions, senders, mutations } =
    params;
  const chatState = createBaseReturn({
    session,
    messagesState,
    historyState,
    actions,
    isSending: senders.isSending,
    mutations,
  });
  if (enableStreaming === true) {
    chatState.streaming = senders.streaming;
    chatState.cancelStream = senders.cancelStream;
  }
  return chatState;
}
