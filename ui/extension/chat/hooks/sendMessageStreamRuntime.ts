import type { QueryClient } from '@tanstack/react-query';
import type { SendMessageMutationParams } from './sendMessageUtils';
import type {
  CacheTranscript,
  SetStreamingState,
  StreamCallbacks,
  StreamRefs,
  StreamingSendResult,
  StreamingState,
  UseSendMessageStreamOptions,
} from './sendMessageStreamTypes';
import { executeStreamRequest, buildUnavailableResult } from './sendMessageStreamOutcome';
import { prepareStreamRequest, reservePendingSend } from './sendMessageStreamRequest';

export function createIdleStreamingState(): StreamingState {
  return {
    isStreaming: false,
    streamedContent: '',
    meta: null,
    error: null,
    isComplete: false,
  };
}

function clearPendingRefs(refs: StreamRefs): void {
  refs.abortControllerRef.current = null;
  refs.pendingSendKeyRef.current = null;
  refs.activeRequestIdRef.current = null;
}

export function abortAndClearPendingRefs(refs: StreamRefs): void {
  refs.abortControllerRef.current?.abort();
  clearPendingRefs(refs);
}

async function executePreparedRequest({
  processTextStream,
  prepared,
  params,
  queryClient,
  setStreamingState,
  callbacks,
  refs,
}: {
  processTextStream: NonNullable<UseSendMessageStreamOptions['apiClient']>['processTextStream'];
  prepared: Awaited<ReturnType<typeof prepareStreamRequest>>;
  params: SendMessageMutationParams;
  queryClient: QueryClient;
  setStreamingState: SetStreamingState;
  callbacks: StreamCallbacks;
  refs: StreamRefs;
}): Promise<StreamingSendResult> {
  try {
    return await executeStreamRequest({
      processTextStream,
      requestPayload: prepared.requestPayload,
      tracker: prepared.tracker,
      params,
      queryClient,
      setStreamingState,
      callbacks,
    });
  } finally {
    clearPendingRefs(refs);
  }
}

export async function runSendMessageStream({
  params,
  apiClient,
  pageUrl,
  courseCode,
  cacheTranscript,
  queryClient,
  setStreamingState,
  refs,
  callbacks,
}: {
  params: SendMessageMutationParams;
  apiClient: UseSendMessageStreamOptions['apiClient'];
  pageUrl: string;
  courseCode: string | null;
  cacheTranscript: CacheTranscript;
  queryClient: QueryClient;
  setStreamingState: SetStreamingState;
  refs: StreamRefs;
  callbacks: StreamCallbacks;
}): Promise<StreamingSendResult> {
  if (!reservePendingSend({ params, pendingSendKeyRef: refs.pendingSendKeyRef })) {
    return { success: false };
  }

  const processTextStream = apiClient?.processTextStream;
  if (processTextStream === undefined) {
    clearPendingRefs(refs);
    return buildUnavailableResult({ setStreamingState, callbacks });
  }

  const prepared = await prepareStreamRequest({
    params,
    pageUrl,
    courseCode,
    cacheTranscript,
    queryClient,
    setStreamingState,
    refs,
    callbacks,
  });
  return executePreparedRequest({
    processTextStream,
    prepared,
    params,
    queryClient,
    setStreamingState,
    callbacks,
    refs,
  });
}
