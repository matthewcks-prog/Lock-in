import type { QueryClient } from '@tanstack/react-query';
import type { UseChatOptions } from '../types';
import { createSendSuccessHandler } from './createSendSuccessHandler';
import type { useChatHistory } from './useChatHistory';
import type { useChatSessionState } from './useChatSessionState';
import { useSendMessage } from './useSendMessage';
import { useSendMessageStream } from './useSendMessageStream';

type SessionState = ReturnType<typeof useChatSessionState>;
type HistoryState = ReturnType<typeof useChatHistory>;
type BlockingSendState = ReturnType<typeof useSendMessage>;
type StreamingSendState = ReturnType<typeof useSendMessageStream>;

export interface ChatSenders {
  sendMessageMutation: BlockingSendState['sendMessage'];
  sendMessageStream: StreamingSendState['sendMessageStream'];
  cancelStream: StreamingSendState['cancelPending'];
  isSending: boolean;
  streaming: Pick<
    StreamingSendState,
    'isStreaming' | 'streamedContent' | 'meta' | 'error' | 'isComplete'
  >;
}

export interface UseChatSendersParams {
  apiClient: UseChatOptions['apiClient'];
  pageUrl: string;
  courseCode: string | null;
  enableStreaming: boolean | undefined;
  queryClient: QueryClient;
  activeChatIdRef: SessionState['activeChatIdRef'];
  activeHistoryIdRef: SessionState['activeHistoryIdRef'];
  setActiveChatId: SessionState['setActiveChatId'];
  setActiveHistoryId: SessionState['setActiveHistoryId'];
  setError: SessionState['setError'];
  upsertHistory: HistoryState['upsertHistory'];
}

export function useChatSenders(params: UseChatSendersParams): ChatSenders {
  const {
    apiClient,
    pageUrl,
    courseCode,
    enableStreaming,
    queryClient,
    activeChatIdRef,
    activeHistoryIdRef,
    setActiveChatId,
    setActiveHistoryId,
    setError,
    upsertHistory,
  } = params;
  const handleSendSuccess = createSendSuccessHandler({
    queryClient,
    activeChatIdRef,
    activeHistoryIdRef,
    setActiveChatId,
    setActiveHistoryId,
    upsertHistory,
  });
  const sendOptions = {
    apiClient,
    pageUrl,
    courseCode,
    onSuccess: handleSendSuccess,
    onError: setError,
  };
  const blocking = useSendMessage(sendOptions);
  const streaming = useSendMessageStream(sendOptions);

  return {
    sendMessageMutation: blocking.sendMessage,
    sendMessageStream: streaming.sendMessageStream,
    cancelStream: streaming.cancelPending,
    isSending: enableStreaming === true ? streaming.isStreaming : blocking.isSending,
    streaming: {
      isStreaming: streaming.isStreaming,
      streamedContent: streaming.streamedContent,
      meta: streaming.meta,
      error: streaming.error,
      isComplete: streaming.isComplete,
    },
  };
}
