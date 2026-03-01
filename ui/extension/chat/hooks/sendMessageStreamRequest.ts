import type { QueryClient } from '@tanstack/react-query';
import type {
  ProcessTextStreamParams,
  StreamDeltaEvent,
  StreamErrorEvent,
  StreamFinalEvent,
  StreamMetaEvent,
} from '@api/client';
import type { MutableRefObject } from 'react';
import type { SendMessageMutationParams } from './sendMessageUtils';
import {
  buildChatHistory,
  buildIdempotencyKey,
  cacheTranscriptIfNeeded,
  resolveApiChatId,
  resolveIdempotencyKey,
  resolveSelectionPayload,
  resolveUserMessagePayload,
} from './sendMessageUtils';
import { updateOptimisticMessage } from './streamMessageCache';
import type {
  CacheTranscript,
  SetStreamingState,
  StreamCallbacks,
  StreamRefs,
  StreamingState,
  StreamTracker,
} from './sendMessageStreamTypes';

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function createActiveStreamingState(): StreamingState {
  return {
    isStreaming: true,
    streamedContent: '',
    meta: null,
    error: null,
    isComplete: false,
  };
}

export function reservePendingSend({
  params,
  pendingSendKeyRef,
}: {
  params: SendMessageMutationParams;
  pendingSendKeyRef: MutableRefObject<string | null>;
}): boolean {
  const idempotencyKey = isNonEmptyString(params.idempotencyKey)
    ? params.idempotencyKey
    : buildIdempotencyKey(params);
  if (pendingSendKeyRef.current === idempotencyKey) return false;
  pendingSendKeyRef.current = idempotencyKey;
  return true;
}

function activateRequest({
  abortControllerRef,
  activeRequestIdRef,
}: {
  abortControllerRef: MutableRefObject<AbortController | null>;
  activeRequestIdRef: MutableRefObject<string | null>;
}): { requestId: string; signal: AbortSignal } {
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();
  const requestId = crypto.randomUUID();
  activeRequestIdRef.current = requestId;
  return { requestId, signal: abortControllerRef.current.signal };
}

function buildRequestPayload({
  params,
  pageUrl,
  courseCode,
  signal,
}: {
  params: SendMessageMutationParams;
  pageUrl: string;
  courseCode: string | null;
  signal: AbortSignal;
}): ProcessTextStreamParams {
  const requestPayload: ProcessTextStreamParams = {
    selection: resolveSelectionPayload(params),
    chatHistory: buildChatHistory(params),
    signal,
  };
  const idempotencyKey = resolveIdempotencyKey(params);
  if (idempotencyKey.length > 0) requestPayload.idempotencyKey = idempotencyKey;
  const userMessagePayload = resolveUserMessagePayload(params);
  if (userMessagePayload !== undefined) requestPayload.newUserMessage = userMessagePayload;
  const apiChatId = resolveApiChatId(params);
  if (isNonEmptyString(apiChatId)) requestPayload.chatId = apiChatId;
  const resolvedPageUrl = params.pageUrl ?? pageUrl;
  if (resolvedPageUrl.length > 0) requestPayload.pageUrl = resolvedPageUrl;
  const resolvedCourseCode = params.courseCode ?? courseCode ?? null;
  if (isNonEmptyString(resolvedCourseCode)) requestPayload.courseCode = resolvedCourseCode;
  if (Array.isArray(params.attachmentIds) && params.attachmentIds.length > 0) {
    requestPayload.attachments = params.attachmentIds;
  }
  if (params.isRegeneration === true) requestPayload.regenerate = true;
  return requestPayload;
}

function createTracker(): StreamTracker {
  return { accumulated: '', meta: null, finalContent: undefined };
}

function createMetaHandler({
  requestId,
  activeRequestIdRef,
  tracker,
  setStreamingState,
  onStreamStart,
}: {
  requestId: string;
  activeRequestIdRef: MutableRefObject<string | null>;
  tracker: StreamTracker;
  setStreamingState: SetStreamingState;
  onStreamStart: ((meta: StreamMetaEvent) => void) | undefined;
}): (meta: StreamMetaEvent) => void {
  return (meta) => {
    if (activeRequestIdRef.current !== requestId) return;
    tracker.meta = meta;
    setStreamingState((prev) => ({ ...prev, meta }));
    onStreamStart?.(meta);
  };
}

function createDeltaHandler({
  requestId,
  activeRequestIdRef,
  tracker,
  setStreamingState,
  onStreamDelta,
  queryClient,
}: {
  requestId: string;
  activeRequestIdRef: MutableRefObject<string | null>;
  tracker: StreamTracker;
  setStreamingState: SetStreamingState;
  onStreamDelta: ((delta: StreamDeltaEvent, accumulated: string) => void) | undefined;
  queryClient: QueryClient;
}): (delta: StreamDeltaEvent) => void {
  return (delta) => {
    if (activeRequestIdRef.current !== requestId) return;
    tracker.accumulated += delta.content;
    setStreamingState((prev) => ({ ...prev, streamedContent: tracker.accumulated }));
    onStreamDelta?.(delta, tracker.accumulated);
    if (isNonEmptyString(tracker.meta?.chatId)) {
      updateOptimisticMessage(queryClient, tracker.meta.chatId, tracker.accumulated);
    }
  };
}

function createFinalHandler({
  requestId,
  activeRequestIdRef,
  tracker,
  setStreamingState,
  onStreamComplete,
}: {
  requestId: string;
  activeRequestIdRef: MutableRefObject<string | null>;
  tracker: StreamTracker;
  setStreamingState: SetStreamingState;
  onStreamComplete: ((final: StreamFinalEvent) => void) | undefined;
}): (final: StreamFinalEvent) => void {
  return (final) => {
    if (activeRequestIdRef.current !== requestId) return;
    tracker.finalContent = final.content;
    const streamedContent = final.content.length > 0 ? final.content : tracker.accumulated;
    setStreamingState((prev) => ({ ...prev, streamedContent, isComplete: true }));
    onStreamComplete?.(final);
  };
}

function createErrorHandler({
  requestId,
  activeRequestIdRef,
  setStreamingState,
  onStreamError,
}: {
  requestId: string;
  activeRequestIdRef: MutableRefObject<string | null>;
  setStreamingState: SetStreamingState;
  onStreamError: ((error: StreamErrorEvent) => void) | undefined;
}): (error: StreamErrorEvent) => void {
  return (error) => {
    if (activeRequestIdRef.current !== requestId) return;
    setStreamingState((prev) => ({ ...prev, error, isStreaming: false }));
    onStreamError?.(error);
  };
}

function bindRequestCallbacks({
  requestPayload,
  requestId,
  activeRequestIdRef,
  tracker,
  setStreamingState,
  callbacks,
  queryClient,
}: {
  requestPayload: ProcessTextStreamParams;
  requestId: string;
  activeRequestIdRef: MutableRefObject<string | null>;
  tracker: StreamTracker;
  setStreamingState: SetStreamingState;
  callbacks: StreamCallbacks;
  queryClient: QueryClient;
}): void {
  requestPayload.onMeta = createMetaHandler({
    requestId,
    activeRequestIdRef,
    tracker,
    setStreamingState,
    onStreamStart: callbacks.onStreamStart,
  });
  requestPayload.onDelta = createDeltaHandler({
    requestId,
    activeRequestIdRef,
    tracker,
    setStreamingState,
    onStreamDelta: callbacks.onStreamDelta,
    queryClient,
  });
  requestPayload.onFinal = createFinalHandler({
    requestId,
    activeRequestIdRef,
    tracker,
    setStreamingState,
    onStreamComplete: callbacks.onStreamComplete,
  });
  requestPayload.onError = createErrorHandler({
    requestId,
    activeRequestIdRef,
    setStreamingState,
    onStreamError: callbacks.onStreamError,
  });
}

export async function prepareStreamRequest({
  params,
  pageUrl,
  courseCode,
  cacheTranscript,
  queryClient,
  setStreamingState,
  refs,
  callbacks,
}: {
  params: SendMessageMutationParams;
  pageUrl: string;
  courseCode: string | null;
  cacheTranscript: CacheTranscript;
  queryClient: QueryClient;
  setStreamingState: SetStreamingState;
  refs: StreamRefs;
  callbacks: StreamCallbacks;
}): Promise<{ requestPayload: ProcessTextStreamParams; tracker: StreamTracker }> {
  const requestContext = activateRequest({
    abortControllerRef: refs.abortControllerRef,
    activeRequestIdRef: refs.activeRequestIdRef,
  });
  setStreamingState(createActiveStreamingState());
  await cacheTranscriptIfNeeded(cacheTranscript, params.transcriptContext);
  const requestPayload = buildRequestPayload({
    params,
    pageUrl,
    courseCode,
    signal: requestContext.signal,
  });
  const tracker = createTracker();
  bindRequestCallbacks({
    requestPayload,
    requestId: requestContext.requestId,
    activeRequestIdRef: refs.activeRequestIdRef,
    tracker,
    setStreamingState,
    callbacks,
    queryClient,
  });
  return { requestPayload, tracker };
}
