import type { ChatMessage, ChatHistoryItem, HistoryTitleSource } from '../types';
import { buildInitialChatTitle, isValidUUID } from '../types';
import type { SendChatOptionsInput } from './chatSendOptions';
import { coerceSendOptions } from './chatSendOptions';
import type { SendMessageMutationParams } from './sendMessageUtils';
import { chatMessagesKeys } from './useChatMessages';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';
import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';

type UpsertHistory = (
  item: ChatHistoryItem,
  previousId?: string | null,
  titleSource?: HistoryTitleSource,
) => void;

type SendMessage = (params: SendMessageMutationParams) => void;

type SetActiveId = Dispatch<SetStateAction<string | null>>;
type SetError = Dispatch<SetStateAction<Error | null>>;
type SetHistoryOpen = Dispatch<SetStateAction<boolean>>;

type StartNewChat = (text: string, options?: SendChatOptionsInput) => void;

interface SendMessageDeps {
  activeChatId: string | null;
  activeHistoryId: string | null;
  messages: ChatMessage[];
  pageUrl: string;
  courseCode: string | null;
  queryClient: QueryClient;
  upsertHistory: UpsertHistory;
  sendMessage: SendMessage;
  startNewChat: StartNewChat;
  setActiveHistoryId: SetActiveId;
  setIsHistoryOpen: SetHistoryOpen;
  setError: SetError;
}

function buildUserMessage(
  content: string,
  source: 'selection' | 'followup',
  timestamp: string,
  attachments?: ChatMessage['attachments'],
): ChatMessage {
  const message: ChatMessage = {
    id: `user-${Date.now()}`,
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
  deps: SendMessageDeps,
  message: string,
  source: 'selection' | 'followup',
  currentMessages: ChatMessage[],
  activeChatId: string,
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
    chatId: deps.activeChatId,
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

export function createSendMessage(deps: SendMessageDeps) {
  return (text: string, options?: SendChatOptionsInput) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const resolvedOptions = coerceSendOptions(options);
    const source = resolvedOptions.source || 'followup';
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

    const hasChatContext = Boolean(deps.activeChatId || deps.activeHistoryId);

    if (deps.messages.length === 0 && !hasChatContext) {
      deps.startNewChat(trimmed, resolvedOptions);
      return;
    }

    const now = new Date().toISOString();

    const provisionalChatId = isValidUUID(deps.activeChatId)
      ? (deps.activeChatId as string)
      : deps.activeHistoryId || `chat-${Date.now()}`;

    const userMessage = buildUserMessage(trimmed, source, now, attachments);

    deps.setIsHistoryOpen(false);
    deps.setError(null);
    deps.setActiveHistoryId(provisionalChatId);

    const currentMessages =
      deps.queryClient.getQueryData<ChatMessage[]>(
        chatMessagesKeys.byId(deps.activeChatId || provisionalChatId),
      ) || deps.messages;
    const nextMessages = [...currentMessages, userMessage];

    deps.queryClient.setQueryData(
      chatMessagesKeys.byId(deps.activeChatId || provisionalChatId),
      nextMessages,
    );

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

    const payload = buildSendPayload(
      deps,
      trimmed,
      source,
      nextMessages,
      provisionalChatId,
      overrides,
    );

    deps.sendMessage(payload);
  };
}
