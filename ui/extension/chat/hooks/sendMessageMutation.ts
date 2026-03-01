import type { MutableRefObject } from 'react';
import type { UseSendMessageOptions, ChatApiResponse } from '../types';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';
import type { ProcessTextParams } from '@api/resources/lockinClient';
import {
  buildChatHistory,
  cacheTranscriptIfNeeded,
  resolveApiChatId,
  resolveIdempotencyKey,
  resolveSelectionPayload,
  resolveUserMessagePayload,
  type SendMessageMutationParams,
} from './sendMessageUtils';

interface SendMessageMutationDeps {
  apiClient: UseSendMessageOptions['apiClient'];
  pageUrl?: string;
  courseCode?: string | null;
  cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
}

type ProcessTextResponse = Awaited<
  ReturnType<NonNullable<UseSendMessageOptions['apiClient']>['processText']>
>;

function resetAbortController(abortControllerRef: MutableRefObject<AbortController | null>): void {
  if (abortControllerRef.current !== null) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();
}

function assertApiClient(
  apiClient: UseSendMessageOptions['apiClient'],
): NonNullable<UseSendMessageOptions['apiClient']> {
  if (apiClient === null || apiClient.processText === undefined) {
    throw new Error('API client not available');
  }
  return apiClient;
}

function assignNonEmptyString<T extends ProcessTextParams>(
  target: T,
  key: keyof T,
  value: string | null | undefined,
): void {
  if (value !== null && value !== undefined && value.length > 0) {
    target[key] = value as T[keyof T];
  }
}

function buildRequestPayload(
  params: SendMessageMutationParams,
  deps: Pick<SendMessageMutationDeps, 'pageUrl' | 'courseCode'>,
): ProcessTextParams {
  const payload: ProcessTextParams = {
    selection: resolveSelectionPayload(params),
    chatHistory: buildChatHistory(params),
  };

  const userMessagePayload = resolveUserMessagePayload(params);
  if (userMessagePayload !== undefined) {
    payload.newUserMessage = userMessagePayload;
  }

  assignNonEmptyString(payload, 'chatId', resolveApiChatId(params));
  assignNonEmptyString(payload, 'pageUrl', params.pageUrl ?? deps.pageUrl ?? '');
  assignNonEmptyString(payload, 'courseCode', params.courseCode ?? deps.courseCode ?? null);

  if (params.attachmentIds !== undefined && params.attachmentIds.length > 0) {
    payload.attachments = params.attachmentIds;
  }

  const idempotencyKey = resolveIdempotencyKey(params);
  assignNonEmptyString(payload, 'idempotencyKey', idempotencyKey);
  if (params.isRegeneration === true) {
    payload.regenerate = true;
  }
  return payload;
}

function resolveFallbackChatId(params: SendMessageMutationParams): string {
  if (params.chatId !== null && params.chatId !== undefined && params.chatId.length > 0) {
    return params.chatId;
  }
  return `chat-${Date.now()}`;
}

function resolveResponseContent(
  response: ProcessTextResponse | undefined,
  fallback: string,
): string {
  const content = response?.data?.content;
  return typeof content === 'string' ? content : fallback;
}

function applyResponseMetadata(
  result: ChatApiResponse & { resolvedChatId: string },
  response: ProcessTextResponse | undefined,
): void {
  if (response?.chatId !== undefined && response.chatId.length > 0) {
    result.chatId = response.chatId;
  }
  if (response?.chatTitle !== undefined && response.chatTitle.length > 0) {
    result.chatTitle = response.chatTitle;
  }
}

function resolveResult(
  response: ProcessTextResponse | undefined,
  params: SendMessageMutationParams,
): ChatApiResponse & { resolvedChatId: string } {
  const resolvedChatId =
    response?.chatId !== undefined && response.chatId.length > 0
      ? response.chatId
      : resolveFallbackChatId(params);

  const result: ChatApiResponse & { resolvedChatId: string } = {
    content: resolveResponseContent(response, params.message),
    resolvedChatId,
  };
  applyResponseMetadata(result, response);
  return result;
}

export async function sendMessageMutation(
  params: SendMessageMutationParams,
  deps: SendMessageMutationDeps,
): Promise<ChatApiResponse & { resolvedChatId: string }> {
  const apiClient = assertApiClient(deps.apiClient);
  resetAbortController(deps.abortControllerRef);
  await cacheTranscriptIfNeeded(deps.cacheTranscript, params.transcriptContext);
  const response = await apiClient.processText(buildRequestPayload(params, deps));
  return resolveResult(response, params);
}
