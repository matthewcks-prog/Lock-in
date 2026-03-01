/**
 * Assistant Service
 *
 * Business logic for the Lock-in AI assistant.
 * Assumes request is ALREADY VALIDATED by Zod middleware in routes.
 *
 * IMPORTANT: Do NOT add duplicate validation here.
 * All input validation is handled by Zod schemas in /backend/validators/assistantValidators.js
 */

const { logger: baseLogger } = require('../../observability');
const { DAILY_REQUEST_LIMIT } = require('../../config');
const { createIdempotencyStore } = require('../../utils/idempotency');
const { buildRequestContext, shouldGenerateTitle } = require('./assistantFlow');
const chatRepository = require('../../repositories/chatRepository');
const { createChatCompletion } = require('../llm/providerChain');
const { buildStructuredStudyMessages } = require('../llm/structuredMessages');
const { clampHistory } = require('../llm/history');
const { checkDailyLimit } = require('../rateLimitService');
const { chatAssetsService: defaultChatAssetsService } = require('./chatAssetsService');
const { chatTitleService: defaultChatTitleService } = require('./chatTitleService');

const defaultIdempotencyStore = createIdempotencyStore();
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const COMPLETION_TEMPERATURE = 0.4;
const COMPLETION_MAX_TOKENS = 1500;
const COMPLETION_OPERATION = 'chat.completions.create';

function createRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.payload = {
    success: false,
    error: { message },
  };
  return error;
}

function createServices(deps = {}) {
  return {
    logger: deps.logger ?? baseLogger,
    chatRepository: deps.chatRepository ?? chatRepository,
    llmClient: deps.llmClient ?? { createChatCompletion },
    rateLimitService: deps.rateLimitService ?? { checkDailyLimit },
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
    chatTitleService: deps.chatTitleService ?? defaultChatTitleService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
  };
}

function ensureUserContext(userId) {
  if (!userId) {
    throw createRequestError(
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      'User context missing for authenticated request.',
    );
  }
}

async function ensureDailyLimitAllowed(services, userId) {
  const limitCheck = await services.rateLimitService.checkDailyLimit(userId, DAILY_REQUEST_LIMIT);
  if (!limitCheck.allowed) {
    throw createRequestError(HTTP_STATUS_TOO_MANY_REQUESTS, 'Daily limit reached');
  }
}

async function getOrCreateChatRecord(services, { userId, incomingChatId, initialTitle }) {
  if (!incomingChatId) {
    return services.chatRepository.createChat(userId, initialTitle);
  }
  const chatRecord = await services.chatRepository.getChatById(userId, incomingChatId);
  if (!chatRecord) {
    throw createRequestError(
      HTTP_STATUS_NOT_FOUND,
      'The requested chat does not exist for this user.',
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
    throw createRequestError(
      HTTP_STATUS_CONFLICT,
      'Attachments are still processing. Please try again in a moment.',
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

function buildCompletionMessages(context, processedAttachments) {
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

async function generateResponseContent(services, context, processedAttachments) {
  try {
    const finalMessages = buildCompletionMessages(context, processedAttachments);
    const completion = await services.llmClient.createChatCompletion({
      messages: finalMessages,
      temperature: COMPLETION_TEMPERATURE,
      maxTokens: COMPLETION_MAX_TOKENS,
      operation: COMPLETION_OPERATION,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from LLM');
    }
    return responseContent;
  } catch (error) {
    services.logger.error({ err: error }, 'Error generating AI response');
    throw createRequestError(
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      error.message || 'Failed to generate study response. Please try again.',
    );
  }
}

async function linkAssetsToUserMessage(services, { context, linkedAssetIds, userMessage, userId }) {
  if (!context.regenerate && linkedAssetIds.length > 0 && userMessage?.id) {
    await services.chatAssetsService.linkAssetsToMessage(linkedAssetIds, userMessage.id, userId);
  }
}

async function saveAssistantMessage(services, { chatId, userId, effectiveMode, responseContent }) {
  await services.chatRepository.insertChatMessage({
    chat_id: chatId,
    user_id: userId,
    role: 'assistant',
    mode: effectiveMode,
    source: 'highlight',
    input_text: null,
    output_text: responseContent,
  });
}

function createSuccessResponse({ responseContent, chatId, existingTitle, initialTitle }) {
  return {
    success: true,
    data: { content: responseContent },
    chatId,
    chatTitle: existingTitle || initialTitle,
  };
}

function maybeGenerateChatTitle(services, { userId, chatId, context, existingTitle }) {
  if (!shouldGenerateTitle(existingTitle, context.initialTitleFromHistory)) {
    return;
  }

  services.chatTitleService
    .generateChatTitleAsync(userId, chatId, context.firstUserMessage || context.userInputText)
    .catch((error) => {
      services.logger.warn({ err: error }, 'Failed to auto-generate chat title');
    });
}

async function runLockinFlow(services, { userId, context }) {
  const chatRecord = await getOrCreateChatRecord(services, {
    userId,
    incomingChatId: context.incomingChatId,
    initialTitle: context.initialTitle,
  });
  const chatId = chatRecord.id;

  const { processedAttachments, linkedAssetIds } = await resolveAttachmentsForRequest(services, {
    userId,
    attachments: context.attachments,
  });

  const userMessage = await insertUserMessageIfNeeded(services, context, { userId, chatId });
  const responseContent = await generateResponseContent(services, context, processedAttachments);

  await linkAssetsToUserMessage(services, {
    context,
    linkedAssetIds,
    userMessage,
    userId,
  });
  await saveAssistantMessage(services, {
    chatId,
    userId,
    effectiveMode: context.effectiveMode,
    responseContent,
  });
  await services.chatRepository.touchChat(chatId);

  const existingTitle = typeof chatRecord.title === 'string' ? chatRecord.title.trim() : '';
  maybeGenerateChatTitle(services, { userId, chatId, context, existingTitle });

  return createSuccessResponse({
    responseContent,
    chatId,
    existingTitle,
    initialTitle: context.initialTitle,
  });
}

async function handleLockinRequest(services, { userId, payload, idempotencyKey } = {}) {
  const context = buildRequestContext(payload);
  ensureUserContext(userId);
  await ensureDailyLimitAllowed(services, userId);

  const executeRequest = () => runLockinFlow(services, { userId, context });
  if (idempotencyKey) {
    return services.idempotencyStore.run(idempotencyKey, userId, executeRequest);
  }
  return executeRequest();
}

function createAssistantService(deps = {}) {
  const services = createServices(deps);

  return {
    handleLockinRequest: (params) => handleLockinRequest(services, params),
  };
}

const assistantService = createAssistantService();

module.exports = {
  createAssistantService,
  assistantService,
};
