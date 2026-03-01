import type { QueryClient } from '@tanstack/react-query';
import type {
  ProcessTextStreamParams,
  ProcessTextStreamResult,
  StreamErrorEvent,
} from '@api/client';
import type { ChatApiResponse } from '../types';
import type { SendMessageMutationParams } from './sendMessageUtils';
import { chatHistoryKeys } from './useChatHistory';
import { chatMessagesKeys } from './useChatMessages';
import { finalizeStreamMessage } from './streamMessageCache';
import type {
  SetStreamingState,
  StreamCallbacks,
  StreamingSendResult,
  StreamTracker,
} from './sendMessageStreamTypes';

type ProcessTextStream = (params: ProcessTextStreamParams) => Promise<ProcessTextStreamResult>;

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function buildUnavailableResult({
  setStreamingState,
  callbacks,
}: {
  setStreamingState: SetStreamingState;
  callbacks: StreamCallbacks;
}): StreamingSendResult {
  const error: StreamErrorEvent = {
    code: 'API_NOT_AVAILABLE',
    message: 'Streaming API client not available',
    retryable: false,
  };
  setStreamingState((prev) => ({ ...prev, isStreaming: false, error }));
  callbacks.onStreamError?.(error);
  callbacks.onError?.(new Error(error.message));
  return { success: false, error };
}

function resolveContent({
  tracker,
  result,
}: {
  tracker: StreamTracker;
  result: ProcessTextStreamResult;
}): string {
  if (isNonEmptyString(tracker.finalContent)) return tracker.finalContent;
  if (isNonEmptyString(result.content)) return result.content;
  return tracker.accumulated;
}

function resolveCallbackChatId({
  resultChatId,
  paramsChatId,
}: {
  resultChatId: string | undefined;
  paramsChatId: string | null | undefined;
}): string {
  if (isNonEmptyString(resultChatId)) return resultChatId;
  if (isNonEmptyString(paramsChatId)) return paramsChatId;
  return `chat-${Date.now()}`;
}

function finalizeStreamCache({
  queryClient,
  resultChatId,
  paramsChatId,
  content,
}: {
  queryClient: QueryClient;
  resultChatId: string | undefined;
  paramsChatId: string | null | undefined;
  content: string;
}): void {
  const finalChatId = isNonEmptyString(resultChatId)
    ? resultChatId
    : isNonEmptyString(paramsChatId)
      ? paramsChatId
      : null;
  if (finalChatId !== null) {
    finalizeStreamMessage(queryClient, finalChatId, content);
  }
}

function notifySuccess({
  content,
  resultChatId,
  resolvedChatId,
  onSuccess,
}: {
  content: string;
  resultChatId: string | undefined;
  resolvedChatId: string;
  onSuccess: StreamCallbacks['onSuccess'];
}): void {
  const response: ChatApiResponse = { content };
  if (isNonEmptyString(resultChatId)) response.chatId = resultChatId;
  onSuccess?.(response, resolvedChatId);
}

async function invalidateAfterSuccess({
  queryClient,
  chatId,
  isRegeneration,
}: {
  queryClient: QueryClient;
  chatId: string | undefined;
  isRegeneration: boolean;
}): Promise<void> {
  if (!isNonEmptyString(chatId)) return;
  if (!isRegeneration) {
    await queryClient.invalidateQueries({ queryKey: chatMessagesKeys.byId(chatId) });
  }
  await queryClient.invalidateQueries({ queryKey: chatHistoryKeys.all });
}

function buildSuccessResult({
  chatId,
  content,
}: {
  chatId: string | undefined;
  content: string;
}): StreamingSendResult {
  const result: StreamingSendResult = { success: true };
  if (isNonEmptyString(chatId)) result.chatId = chatId;
  if (isNonEmptyString(content)) result.content = content;
  return result;
}

function handleUnsuccessfulResult({
  result,
  setStreamingState,
  callbacks,
}: {
  result: ProcessTextStreamResult;
  setStreamingState: SetStreamingState;
  callbacks: StreamCallbacks;
}): StreamingSendResult {
  setStreamingState((prev) => ({ ...prev, isStreaming: false, error: result.error ?? null }));
  if (result.error !== undefined) {
    callbacks.onError?.(new Error(result.error.message));
    return { success: false, error: result.error };
  }
  return { success: false };
}

async function handleSuccessfulResult({
  result,
  tracker,
  params,
  queryClient,
  setStreamingState,
  callbacks,
}: {
  result: ProcessTextStreamResult;
  tracker: StreamTracker;
  params: SendMessageMutationParams;
  queryClient: QueryClient;
  setStreamingState: SetStreamingState;
  callbacks: StreamCallbacks;
}): Promise<StreamingSendResult> {
  setStreamingState((prev) => ({ ...prev, isStreaming: false, isComplete: true }));
  const content = resolveContent({ tracker, result });
  const resolvedChatId = resolveCallbackChatId({
    resultChatId: result.chatId,
    paramsChatId: params.chatId,
  });
  finalizeStreamCache({
    queryClient,
    resultChatId: result.chatId,
    paramsChatId: params.chatId,
    content,
  });
  notifySuccess({
    content,
    resultChatId: result.chatId,
    resolvedChatId,
    onSuccess: callbacks.onSuccess,
  });
  await invalidateAfterSuccess({
    queryClient,
    chatId: result.chatId,
    isRegeneration: params.isRegeneration === true,
  });
  return buildSuccessResult({ chatId: result.chatId, content });
}

function buildCaughtError(error: unknown): StreamErrorEvent {
  return {
    code: 'STREAM_ERROR',
    message: error instanceof Error ? error.message : 'Unknown error',
    retryable: false,
  };
}

export async function executeStreamRequest({
  processTextStream,
  requestPayload,
  tracker,
  params,
  queryClient,
  setStreamingState,
  callbacks,
}: {
  processTextStream: ProcessTextStream;
  requestPayload: ProcessTextStreamParams;
  tracker: StreamTracker;
  params: SendMessageMutationParams;
  queryClient: QueryClient;
  setStreamingState: SetStreamingState;
  callbacks: StreamCallbacks;
}): Promise<StreamingSendResult> {
  try {
    const result = await processTextStream(requestPayload);
    if (!result.success) {
      return handleUnsuccessfulResult({ result, setStreamingState, callbacks });
    }
    return handleSuccessfulResult({
      result,
      tracker,
      params,
      queryClient,
      setStreamingState,
      callbacks,
    });
  } catch (error) {
    const streamError = buildCaughtError(error);
    setStreamingState((prev) => ({ ...prev, isStreaming: false, error: streamError }));
    callbacks.onStreamError?.(streamError);
    callbacks.onError?.(error instanceof Error ? error : new Error('Unknown error'));
    return { success: false, error: streamError };
  }
}
