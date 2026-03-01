const { buildStructuredStudyMessages } = require('../llm/structuredMessages');
const { clampHistory } = require('../llm/history');
const { createStatusError } = require('./streamingAssistantStream');

const DAILY_REQUEST_LIMIT = 100;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const DEFAULT_META_MODEL = 'gemini-2.0-flash';
const DEFAULT_META_PROVIDER = 'gemini';

async function ensureDailyLimitAllowed(services, userId) {
  const limitCheck = await services.rateLimitService.checkDailyLimit(userId, DAILY_REQUEST_LIMIT);
  if (!limitCheck.allowed) {
    throw createStatusError(
      'Daily limit reached',
      HTTP_STATUS_TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED',
    );
  }
}

async function getOrCreateChatRecord(services, { userId, incomingChatId, initialTitle }) {
  if (!incomingChatId) {
    return services.chatRepository.createChat(userId, initialTitle);
  }

  const chatRecord = await services.chatRepository.getChatById(userId, incomingChatId);
  if (!chatRecord) {
    throw createStatusError(
      'The requested chat does not exist for this user.',
      HTTP_STATUS_NOT_FOUND,
      'CHAT_NOT_FOUND',
    );
  }
  return chatRecord;
}

async function resolveAttachmentsForRequest(services, { userId, attachments }) {
  const attachmentResult = await services.chatAssetsService.resolveAttachmentsForMessage({
    userId,
    assetIds: attachments,
  });
  if (attachmentResult.pendingAssetIds.length > 0) {
    throw createStatusError(
      'Attachments are still processing. Please try again.',
      HTTP_STATUS_CONFLICT,
      'ASSETS_PROCESSING',
    );
  }
  return attachmentResult;
}

async function insertUserMessageIfNeeded(services, context, { userId, chatId }) {
  if (context.regenerate) {
    return null;
  }

  return services.chatRepository.insertChatMessage({
    chat_id: chatId,
    user_id: userId,
    role: 'user',
    mode: context.effectiveMode,
    source: 'highlight',
    input_text: context.userInputText,
    output_text: null,
  });
}

async function linkAssetsToUserMessage(services, { context, linkedAssetIds, userMessage, userId }) {
  if (!context.regenerate && linkedAssetIds.length > 0 && userMessage?.id) {
    await services.chatAssetsService.linkAssetsToMessage(linkedAssetIds, userMessage.id, userId);
  }
}

function buildFinalMessages(context, processedAttachments) {
  const { messages } = buildStructuredStudyMessages({
    selection: context.trimmedSelection,
    pageContext: context.pageContext,
    pageUrl: context.pageUrl,
    courseCode: context.courseCode,
    language: context.language,
    chatHistory: context.chatHistory,
    newUserMessage: context.trimmedUserMessage || undefined,
    attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
  });
  return clampHistory(messages);
}

function writeInitialStreamMeta(sseWriter, { chatId, messageId, requestId }) {
  sseWriter.writeMeta({
    chatId,
    messageId,
    requestId,
    model: DEFAULT_META_MODEL,
    provider: DEFAULT_META_PROVIDER,
  });
}

module.exports = {
  ensureDailyLimitAllowed,
  getOrCreateChatRecord,
  resolveAttachmentsForRequest,
  insertUserMessageIfNeeded,
  linkAssetsToUserMessage,
  buildFinalMessages,
  writeInitialStreamMeta,
};
