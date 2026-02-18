import type { ChatAttachment, ChatMessage, ChatHistoryItem, HistoryTitleSource } from '../types';
import { buildInitialChatTitle, isValidUUID } from '../types';
import type { SendChatMessageOptions, SendChatOptionsInput } from './chatSendOptions';
import { coerceSendOptions } from './chatSendOptions';
import type { SendMessageMutationParams } from './sendMessageUtils';
import { chatMessagesKeys } from './useChatMessages';
import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import {
  buildSendPayload,
  buildUserMessage,
  type SendPayloadOverrides,
} from './chatSendPayloadBuilders';

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

interface PreparedSendInput {
  trimmed: string;
  source: 'selection' | 'followup';
  attachments?: ChatAttachment[];
  options: SendChatMessageOptions;
  overrides: SendPayloadOverrides;
}

interface ChatIdentifiers {
  provisionalChatId: string;
  queryChatId: string;
}

function hasChatId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function buildSendOverrides(options: SendChatMessageOptions): SendPayloadOverrides {
  const overrides: SendPayloadOverrides = {};
  if (Array.isArray(options.attachmentIds) && options.attachmentIds.length > 0) {
    overrides.attachmentIds = options.attachmentIds;
  }
  if (options.selectionOverride !== undefined) {
    overrides.selectionOverride = options.selectionOverride;
  }
  if (options.userMessageOverride !== undefined) {
    overrides.userMessageOverride = options.userMessageOverride;
  }
  if (options.transcriptContext !== undefined && options.transcriptContext !== null) {
    overrides.transcriptContext = options.transcriptContext;
  }
  return overrides;
}

function prepareSendInput(text: string, options?: SendChatOptionsInput): PreparedSendInput | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const resolvedOptions = coerceSendOptions(options);
  const prepared: PreparedSendInput = {
    trimmed,
    source: resolvedOptions.source ?? 'followup',
    options: resolvedOptions,
    overrides: buildSendOverrides(resolvedOptions),
  };
  if (resolvedOptions.attachments !== undefined) {
    prepared.attachments = resolvedOptions.attachments;
  }
  return prepared;
}

function hasChatContext(deps: SendMessageDeps): boolean {
  return hasChatId(deps.activeChatId) || hasChatId(deps.activeHistoryId);
}

function resolveChatIdentifiers(deps: SendMessageDeps): ChatIdentifiers {
  // Use actual UUIDs for provisional IDs to avoid cache mismatch issues
  const provisionalChatId = isValidUUID(deps.activeChatId)
    ? (deps.activeChatId as string)
    : hasChatId(deps.activeHistoryId) && isValidUUID(deps.activeHistoryId)
      ? deps.activeHistoryId
      : crypto.randomUUID(); // FIXED: Use crypto.randomUUID() instead of timestamp

  const queryChatId = hasChatId(deps.activeChatId) ? deps.activeChatId : provisionalChatId;
  return { provisionalChatId, queryChatId };
}

function appendUserMessageToCache({
  queryClient,
  queryChatId,
  fallbackMessages,
  userMessage,
}: {
  queryClient: QueryClient;
  queryChatId: string;
  fallbackMessages: ChatMessage[];
  userMessage: ChatMessage;
}): ChatMessage[] {
  const currentMessages =
    queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(queryChatId)) ?? fallbackMessages;
  const nextMessages = [...currentMessages, userMessage];
  queryClient.setQueryData(chatMessagesKeys.byId(queryChatId), nextMessages);
  return nextMessages;
}

function sendToExistingChat({
  deps,
  input,
}: {
  deps: SendMessageDeps;
  input: PreparedSendInput;
}): void {
  const now = new Date().toISOString();
  const identifiers = resolveChatIdentifiers(deps);
  const userMessage = buildUserMessage({
    id: `user-${Date.now()}`,
    content: input.trimmed,
    source: input.source,
    timestamp: now,
    ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
  });

  deps.setIsHistoryOpen(false);
  deps.setError(null);
  deps.setActiveHistoryId(identifiers.provisionalChatId);

  const nextMessages = appendUserMessageToCache({
    queryClient: deps.queryClient,
    queryChatId: identifiers.queryChatId,
    fallbackMessages: deps.messages,
    userMessage,
  });

  deps.upsertHistory(
    {
      id: identifiers.provisionalChatId,
      title: buildInitialChatTitle(input.trimmed),
      updatedAt: now,
      lastMessage: input.trimmed,
    },
    undefined,
    'local',
  );

  deps.sendMessage(
    buildSendPayload({
      message: input.trimmed,
      source: input.source,
      pageUrl: deps.pageUrl,
      chatId: deps.activeChatId,
      currentMessages: nextMessages,
      activeChatId: identifiers.provisionalChatId,
      courseCode: deps.courseCode,
      overrides: input.overrides,
    }),
  );
}

export function createSendMessage(deps: SendMessageDeps) {
  return (text: string, options?: SendChatOptionsInput) => {
    const input = prepareSendInput(text, options);
    if (input === null) {
      return;
    }

    if (deps.messages.length === 0 && !hasChatContext(deps)) {
      deps.startNewChat(input.trimmed, input.options);
      return;
    }

    sendToExistingChat({ deps, input });
  };
}
