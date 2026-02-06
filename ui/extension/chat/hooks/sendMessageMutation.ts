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

export async function sendMessageMutation(
  params: SendMessageMutationParams,
  deps: {
    apiClient: UseSendMessageOptions['apiClient'];
    pageUrl?: string;
    courseCode?: string | null;
    cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>;
    abortControllerRef: MutableRefObject<AbortController | null>;
  },
): Promise<ChatApiResponse & { resolvedChatId: string }> {
  const { apiClient, pageUrl, courseCode, cacheTranscript, abortControllerRef } = deps;

  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();

  if (!apiClient?.processText) {
    throw new Error('API client not available');
  }

  await cacheTranscriptIfNeeded(cacheTranscript, params.transcriptContext);

  const baseHistory = buildChatHistory(params);
  const apiChatId = resolveApiChatId(params);
  const selectionPayload = resolveSelectionPayload(params);
  const userMessagePayload = resolveUserMessagePayload(params);
  const idempotencyKey = resolveIdempotencyKey(params);

  const requestPayload: ProcessTextParams = {
    selection: selectionPayload,
    mode: params.mode,
    chatHistory: baseHistory,
  };
  if (userMessagePayload !== undefined) {
    requestPayload.newUserMessage = userMessagePayload;
  }
  if (apiChatId) {
    requestPayload.chatId = apiChatId;
  }
  const resolvedPageUrl = params.pageUrl || pageUrl;
  if (resolvedPageUrl) {
    requestPayload.pageUrl = resolvedPageUrl;
  }
  const resolvedCourseCode = params.courseCode ?? courseCode ?? null;
  if (resolvedCourseCode) {
    requestPayload.courseCode = resolvedCourseCode;
  }
  if (params.attachmentIds && params.attachmentIds.length > 0) {
    requestPayload.attachments = params.attachmentIds;
  }
  if (idempotencyKey) {
    requestPayload.idempotencyKey = idempotencyKey;
  }

  const response = await apiClient.processText(requestPayload);

  const explanation = response?.data?.explanation || `(${params.mode}) ${params.message}`;
  const resolvedChatId = response?.chatId || params.chatId || `chat-${Date.now()}`;

  const result: ChatApiResponse & { resolvedChatId: string } = {
    explanation,
    resolvedChatId,
  };
  if (response?.chatId) {
    result.chatId = response.chatId;
  }
  if (response?.chatTitle) {
    result.chatTitle = response.chatTitle;
  }
  return result;
}
