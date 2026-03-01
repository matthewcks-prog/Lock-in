import type { ChatAttachment, ChatMessage } from '../types';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';
import type { SendMessageMutationParams } from './sendMessageUtils';

export interface SendPayloadOverrides {
  attachmentIds?: string[];
  selectionOverride?: string;
  userMessageOverride?: string;
  transcriptContext?: TranscriptCacheInput;
}

interface BuildUserMessageParams {
  id: string;
  content: string;
  source: 'selection' | 'followup';
  timestamp: string;
  attachments?: ChatAttachment[];
}

interface BuildSendPayloadParams {
  message: string;
  source: 'selection' | 'followup';
  pageUrl: string;
  chatId: string | null;
  currentMessages: ChatMessage[];
  activeChatId: string | null;
  courseCode: string | null;
  overrides: SendPayloadOverrides;
}

function hasItems<T>(items: T[] | undefined): items is T[] {
  return Array.isArray(items) && items.length > 0;
}

export function buildUserMessage(params: BuildUserMessageParams): ChatMessage {
  const message: ChatMessage = {
    id: params.id,
    role: 'user',
    content: params.content,
    timestamp: params.timestamp,
    source: params.source,
  };
  if (hasItems(params.attachments)) {
    message.attachments = params.attachments;
  }
  return message;
}

export function buildSendPayload(params: BuildSendPayloadParams): SendMessageMutationParams {
  const payload: SendMessageMutationParams = {
    message: params.message,
    source: params.source,
    pageUrl: params.pageUrl,
    chatId: params.chatId,
    currentMessages: params.currentMessages,
    activeChatId: params.activeChatId,
  };
  if (typeof params.courseCode === 'string' && params.courseCode.length > 0) {
    payload.courseCode = params.courseCode;
  }
  if (hasItems(params.overrides.attachmentIds)) {
    payload.attachmentIds = params.overrides.attachmentIds;
  }
  if (params.overrides.selectionOverride !== undefined) {
    payload.selectionOverride = params.overrides.selectionOverride;
  }
  if (params.overrides.userMessageOverride !== undefined) {
    payload.userMessageOverride = params.overrides.userMessageOverride;
  }
  if (params.overrides.transcriptContext !== undefined) {
    payload.transcriptContext = params.overrides.transcriptContext;
  }
  return payload;
}
