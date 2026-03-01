import type { ChatAttachment, ChatHistoryItem, ChatMessage, HistoryTitleSource } from '../types';
import { buildInitialChatTitle } from '../types';
import type { SendChatOptionsInput } from './chatSendOptions';
import { coerceSendOptions } from './chatSendOptions';
import type { SendMessageMutationParams } from './sendMessageUtils';
import type { Dispatch, SetStateAction } from 'react';
import {
  buildSendPayload,
  buildUserMessage,
  type SendPayloadOverrides,
} from './chatSendPayloadBuilders';

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

interface PreparedStartInput {
  trimmed: string;
  source: 'selection' | 'followup';
  attachments?: ChatAttachment[];
  overrides: SendPayloadOverrides;
}

function buildStartOverrides({
  attachmentIds,
  selectionOverride,
  userMessageOverride,
  transcriptContext,
}: {
  attachmentIds?: string[];
  selectionOverride?: string;
  userMessageOverride?: string;
  transcriptContext?: SendPayloadOverrides['transcriptContext'] | null;
}): SendPayloadOverrides {
  return {
    ...(Array.isArray(attachmentIds) && attachmentIds.length > 0 ? { attachmentIds } : {}),
    ...(selectionOverride !== undefined ? { selectionOverride } : {}),
    ...(userMessageOverride !== undefined ? { userMessageOverride } : {}),
    ...(transcriptContext !== undefined && transcriptContext !== null ? { transcriptContext } : {}),
  };
}

function prepareStartInput(
  text: string,
  options?: SendChatOptionsInput,
): PreparedStartInput | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const resolvedOptions = coerceSendOptions(options);
  const prepared: PreparedStartInput = {
    trimmed,
    source: resolvedOptions.source ?? 'selection',
    overrides: buildStartOverrides(resolvedOptions),
  };
  if (resolvedOptions.attachments !== undefined) {
    prepared.attachments = resolvedOptions.attachments;
  }
  return prepared;
}

function runStartNewChat({
  deps,
  input,
}: {
  deps: StartNewChatDeps;
  input: PreparedStartInput;
}): void {
  const now = new Date().toISOString();
  const provisionalChatId = `chat-${Date.now()}`;
  const userMessageInput: Parameters<typeof buildUserMessage>[0] = {
    id: `${provisionalChatId}-user`,
    content: input.trimmed,
    source: input.source,
    timestamp: now,
  };
  if (input.attachments !== undefined) {
    userMessageInput.attachments = input.attachments;
  }
  const userMessage = buildUserMessage(userMessageInput);

  deps.setIsHistoryOpen(false);
  deps.setError(null);
  deps.setActiveChatId(null);
  deps.setActiveHistoryId(provisionalChatId);
  deps.setMessages(provisionalChatId, [userMessage]);
  deps.upsertHistory(
    {
      id: provisionalChatId,
      title: buildInitialChatTitle(input.trimmed),
      updatedAt: now,
      lastMessage: input.trimmed,
    },
    undefined,
    'local',
  );
  deps.setActiveChatId(provisionalChatId);

  const payload: SendMessageMutationParams = buildSendPayload({
    message: input.trimmed,
    source: input.source,
    pageUrl: deps.pageUrl,
    chatId: null,
    currentMessages: [userMessage],
    activeChatId: provisionalChatId,
    courseCode: deps.courseCode,
    overrides: input.overrides,
  });
  deps.sendMessage(payload);
}

export function createStartNewChat(deps: StartNewChatDeps) {
  return (text: string, options?: SendChatOptionsInput) => {
    const input = prepareStartInput(text, options);
    if (input === null) {
      return;
    }
    runStartNewChat({ deps, input });
  };
}
