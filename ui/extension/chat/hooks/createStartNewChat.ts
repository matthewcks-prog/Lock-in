import type { ChatAttachment, ChatHistoryItem, ChatMessage, HistoryTitleSource } from '../types';
import { buildInitialChatTitle } from '../types';
import type { SendChatOptionsInput } from './chatSendOptions';
import { coerceSendOptions } from './chatSendOptions';
import type { SendMessageMutationParams } from './sendMessageUtils';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';
import type { Dispatch, SetStateAction } from 'react';

type SetMessages = (chatId: string, messages: ChatMessage[]) => void;
type UpsertHistory = (
  item: ChatHistoryItem,
  previousId?: string | null,
  titleSource?: HistoryTitleSource,
) => void;
type SendMessage = (params: SendMessageMutationParams) => void;

type SetActiveId = Dispatch<SetStateAction<string | null>>;
type SetError = Dispatch<SetStateAction<Error | null>>;
type SetHistoryOpen = Dispatch<SetStateAction<boolean>>;

interface StartNewChatDeps {
  pageUrl: string;
  courseCode: string | null;
  setMessages: SetMessages;
  upsertHistory: UpsertHistory;
  sendMessage: SendMessage;
  setActiveChatId: SetActiveId;
  setActiveHistoryId: SetActiveId;
  setIsHistoryOpen: SetHistoryOpen;
  setError: SetError;
}

function buildUserMessage(
  id: string,
  content: string,
  source: 'selection' | 'followup',
  timestamp: string,
  attachments?: ChatAttachment[],
): ChatMessage {
  const message: ChatMessage = {
    id,
    role: 'user',
    content,
    timestamp,
    source,
  };
  if (attachments && attachments.length > 0) {
    message.attachments = attachments;
  }
  return message;
}

function buildSendPayload(
  deps: StartNewChatDeps,
  message: string,
  source: 'selection' | 'followup',
  currentMessages: ChatMessage[],
  activeChatId: string | null,
  options: {
    attachmentIds?: string[];
    selectionOverride?: string;
    userMessageOverride?: string;
    transcriptContext?: TranscriptCacheInput;
  },
): SendMessageMutationParams {
  const payload: SendMessageMutationParams = {
    message,
    source,
    pageUrl: deps.pageUrl,
    chatId: null,
    currentMessages,
    activeChatId,
  };
  if (deps.courseCode) {
    payload.courseCode = deps.courseCode;
  }
  if (options.attachmentIds && options.attachmentIds.length > 0) {
    payload.attachmentIds = options.attachmentIds;
  }
  if (options.selectionOverride !== undefined) {
    payload.selectionOverride = options.selectionOverride;
  }
  if (options.userMessageOverride !== undefined) {
    payload.userMessageOverride = options.userMessageOverride;
  }
  if (options.transcriptContext) {
    payload.transcriptContext = options.transcriptContext;
  }
  return payload;
}

export function createStartNewChat(deps: StartNewChatDeps) {
  return (text: string, options?: SendChatOptionsInput) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const resolvedOptions = coerceSendOptions(options);
    const source = resolvedOptions.source || 'selection';
    const attachments = resolvedOptions.attachments;
    const attachmentIds = resolvedOptions.attachmentIds;
    const selectionOverride = resolvedOptions.selectionOverride;
    const userMessageOverride = resolvedOptions.userMessageOverride;
    const transcriptContext = resolvedOptions.transcriptContext;
    const overrides: {
      attachmentIds?: string[];
      selectionOverride?: string;
      userMessageOverride?: string;
      transcriptContext?: TranscriptCacheInput;
    } = {};
    if (attachmentIds && attachmentIds.length > 0) {
      overrides.attachmentIds = attachmentIds;
    }
    if (selectionOverride !== undefined) {
      overrides.selectionOverride = selectionOverride;
    }
    if (userMessageOverride !== undefined) {
      overrides.userMessageOverride = userMessageOverride;
    }
    if (transcriptContext) {
      overrides.transcriptContext = transcriptContext;
    }

    const now = new Date().toISOString();
    const provisionalChatId = `chat-${Date.now()}`;

    const userMessage = buildUserMessage(
      `${provisionalChatId}-user`,
      trimmed,
      source,
      now,
      attachments,
    );

    deps.setIsHistoryOpen(false);
    deps.setError(null);
    deps.setActiveChatId(null);
    deps.setActiveHistoryId(provisionalChatId);

    deps.setMessages(provisionalChatId, [userMessage]);

    deps.upsertHistory(
      {
        id: provisionalChatId,
        title: buildInitialChatTitle(trimmed),
        updatedAt: now,
        lastMessage: trimmed,
      },
      undefined,
      'local',
    );

    deps.setActiveChatId(provisionalChatId);

    const payload = buildSendPayload(
      deps,
      trimmed,
      source,
      [userMessage],
      provisionalChatId,
      overrides,
    );

    deps.sendMessage(payload);
  };
}
