/**
 * Streaming Assistant Service
 *
 * Handles streaming chat completion via SSE and persists the final assistant
 * message after streaming completes.
 */

const { randomUUID } = require('crypto');
const { chatCompletionStream } = require('../llm/providerChain');
const { createIdempotencyStore } = require('../../utils/idempotency');
const { buildRequestContext, shouldGenerateTitle } = require('./assistantFlow');
const chatRepository = require('../../repositories/chatRepository');
const { checkDailyLimit } = require('../rateLimitService');
const { chatAssetsService: defaultChatAssetsService } = require('./chatAssetsService');
const { chatTitleService: defaultChatTitleService } = require('./chatTitleService');
const {
  handleIdempotencyBegin,
  completeIdempotencyIfNeeded,
} = require('./streamingAssistantIdempotency');
const { createStatusError, streamAssistantResponse } = require('./streamingAssistantStream');
const {
  ensureDailyLimitAllowed,
  getOrCreateChatRecord,
  resolveAttachmentsForRequest,
  insertUserMessageIfNeeded,
  linkAssetsToUserMessage,
  buildFinalMessages,
  writeInitialStreamMeta,
} = require('./streamingAssistantPreparation');

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const defaultIdempotencyStore = createIdempotencyStore();

function createServices(deps = {}) {
  return {
    chatRepository: deps.chatRepository ?? chatRepository,
    rateLimitService: deps.rateLimitService ?? { checkDailyLimit },
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
    chatTitleService: deps.chatTitleService ?? defaultChatTitleService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
    chatCompletionStream: deps.chatCompletionStream ?? chatCompletionStream,
    logger: deps.logger ?? console,
  };
}

function ensureUserContext(userId) {
  if (!userId) {
    throw createStatusError(
      'User context missing for authenticated request.',
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      'AUTH_ERROR',
    );
  }
}

async function saveAssistantMessage(
  services,
  { chatId, userId, assistantMessageId, effectiveMode, responseContent, usage, model, provider },
) {
  await services.chatRepository.insertChatMessage({
    chat_id: chatId,
    user_id: userId,
    role: 'assistant',
    mode: effectiveMode,
    source: 'highlight',
    input_text: null,
    output_text: responseContent,
    metadata: {
      messageId: assistantMessageId,
      usage,
      model,
      provider,
    },
  });
}

function maybeGenerateChatTitle(services, { userId, chatId, context, existingTitle }) {
  if (!shouldGenerateTitle(existingTitle, context.initialTitleFromHistory)) {
    return;
  }

  services.chatTitleService
    .generateChatTitleAsync(userId, chatId, context.firstUserMessage || context.userInputText)
    .catch((error) => {
      services.logger.warn('[StreamingAssistant] Failed to auto-generate chat title:', error);
    });
}

async function initializeStreamingSession(
  services,
  { userId, idempotencyKey, requestId, sseWriter, context },
) {
  const handledByIdempotency = await handleIdempotencyBegin(services.idempotencyStore, {
    idempotencyKey,
    userId,
    incomingChatId: context.incomingChatId,
    requestId,
    sseWriter,
  });
  if (handledByIdempotency) {
    return { handledByIdempotency: true };
  }

  await ensureDailyLimitAllowed(services, userId);

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
  await linkAssetsToUserMessage(services, {
    context,
    linkedAssetIds,
    userMessage,
    userId,
  });

  const finalMessages = buildFinalMessages(context, processedAttachments);
  const assistantMessageId = randomUUID();
  writeInitialStreamMeta(sseWriter, {
    chatId,
    messageId: assistantMessageId,
    requestId,
  });

  return {
    handledByIdempotency: false,
    chatRecord,
    chatId,
    assistantMessageId,
    finalMessages,
  };
}

async function finalizeStreamingSession(
  services,
  {
    streamResult,
    sseWriter,
    chatRecord,
    chatId,
    userId,
    assistantMessageId,
    context,
    idempotencyKey,
  },
) {
  sseWriter.writeFinal(streamResult.responseContent, streamResult.usage);
  await saveAssistantMessage(services, {
    chatId,
    userId,
    assistantMessageId,
    effectiveMode: context.effectiveMode,
    responseContent: streamResult.responseContent,
    usage: streamResult.usage,
    model: streamResult.actualModel,
    provider: streamResult.actualProvider,
  });
  await services.chatRepository.touchChat(chatId);

  const existingTitle = typeof chatRecord.title === 'string' ? chatRecord.title.trim() : '';
  maybeGenerateChatTitle(services, { userId, chatId, context, existingTitle });

  await completeIdempotencyIfNeeded(services.idempotencyStore, {
    idempotencyKey,
    userId,
    responseContent: streamResult.responseContent,
    usage: streamResult.usage,
    chatId,
    chatTitle: existingTitle || context.initialTitle,
  });
}

async function handleLockinStreamRequest(
  services,
  { userId, payload, idempotencyKey, requestId, signal, sseWriter },
) {
  const context = buildRequestContext(payload, 'Attachment analysis');
  ensureUserContext(userId);

  const session = await initializeStreamingSession(services, {
    userId,
    idempotencyKey,
    requestId,
    sseWriter,
    context,
  });
  if (session.handledByIdempotency) {
    return;
  }

  const streamResult = await streamAssistantResponse(services, {
    finalMessages: session.finalMessages,
    signal,
    sseWriter,
    idempotencyKey,
    userId,
    chatId: session.chatId,
    requestId,
  });
  if (streamResult.aborted) {
    return;
  }

  await finalizeStreamingSession(services, {
    streamResult,
    sseWriter,
    chatRecord: session.chatRecord,
    chatId: session.chatId,
    userId,
    assistantMessageId: session.assistantMessageId,
    context,
    idempotencyKey,
  });
}

function createStreamingAssistantService(deps = {}) {
  const services = createServices(deps);
  return {
    handleLockinStreamRequest: (params) => handleLockinStreamRequest(services, params),
  };
}

const streamingAssistantService = createStreamingAssistantService();

module.exports = {
  createStreamingAssistantService,
  streamingAssistantService,
};
