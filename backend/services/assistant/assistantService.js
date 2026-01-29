const { logger: baseLogger } = require('../../observability');
const {
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
} = require('../../config');
const { createIdempotencyStore } = require('../../utils/idempotency');
const {
  validateMode,
  validateUUID,
  validateChatHistory,
  validateText,
} = require('../../utils/validation');
const {
  buildInitialChatTitle,
  extractFirstUserMessage,
  FALLBACK_TITLE,
} = require('../../utils/chatTitle');
const chatRepository = require('../../repositories/chatRepository');
const { generateStructuredStudyResponse } = require('../llmClient');
const { checkDailyLimit } = require('../rateLimitService');
const { chatAssetsService: defaultChatAssetsService } = require('./chatAssetsService');
const { chatTitleService: defaultChatTitleService } = require('./chatTitleService');

const ATTACHMENT_ONLY_TITLE_SEED = 'Attachment-based question';
const defaultIdempotencyStore = createIdempotencyStore();

function createRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.payload = {
    success: false,
    error: { message },
  };
  return error;
}

function createAssistantService(deps = {}) {
  const services = {
    logger: deps.logger ?? baseLogger,
    chatRepository: deps.chatRepository ?? chatRepository,
    llmClient: deps.llmClient ?? { generateStructuredStudyResponse },
    rateLimitService: deps.rateLimitService ?? { checkDailyLimit },
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
    chatTitleService: deps.chatTitleService ?? defaultChatTitleService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
  };

  async function handleLockinRequest({ userId, payload, idempotencyKey } = {}) {
    const {
      selection: selectionFromBody,
      text: legacyText,
      mode,
      chatHistory = [],
      newUserMessage,
      chatId: incomingChatId,
      pageContext,
      pageUrl,
      courseCode,
      language = 'en',
      attachments = [],
    } = payload || {};

    const modeValidation = validateMode(mode);
    if (!modeValidation.valid) {
      throw createRequestError(400, modeValidation.error);
    }

    const historyValidation = validateChatHistory(chatHistory);
    if (!historyValidation.valid) {
      throw createRequestError(400, historyValidation.error);
    }
    const sanitizedHistory = historyValidation.sanitized;
    const isInitialRequest = sanitizedHistory.length === 0;
    const effectiveMode = isInitialRequest ? mode : 'general';

    const selection = selectionFromBody || legacyText || '';
    const trimmedSelection = typeof selection === 'string' ? selection.trim() : '';
    const hasAttachmentIds = Array.isArray(attachments) && attachments.length > 0;

    if (isInitialRequest) {
      if (!trimmedSelection && !hasAttachmentIds) {
        throw createRequestError(400, 'Selection or attachments are required for initial requests');
      }
      if (trimmedSelection) {
        const selectionValidation = validateText(selection, MAX_SELECTION_LENGTH, 'Selection');
        if (!selectionValidation.valid) {
          throw createRequestError(400, selectionValidation.error);
        }
      }
    } else if (trimmedSelection) {
      const selectionValidation = validateText(selection, MAX_SELECTION_LENGTH, 'Selection');
      if (!selectionValidation.valid) {
        throw createRequestError(400, selectionValidation.error);
      }
    }

    if (!mode) {
      throw createRequestError(400, 'Mode is required');
    }

    let trimmedUserMessage = '';
    if (newUserMessage) {
      const messageValidation = validateText(
        newUserMessage,
        MAX_USER_MESSAGE_LENGTH,
        'Follow-up message',
      );
      if (!messageValidation.valid) {
        throw createRequestError(400, messageValidation.error);
      }
      trimmedUserMessage = messageValidation.sanitized;
    }

    if (incomingChatId) {
      const chatIdValidation = validateUUID(incomingChatId);
      if (!chatIdValidation.valid) {
        throw createRequestError(400, chatIdValidation.error);
      }
    }

    const userInputText =
      trimmedUserMessage ||
      trimmedSelection ||
      (hasAttachmentIds ? ATTACHMENT_ONLY_TITLE_SEED : '');
    const initialTitle = buildInitialChatTitle(userInputText || '');
    const firstUserMessage = extractFirstUserMessage(sanitizedHistory);
    const initialTitleFromHistory = buildInitialChatTitle(firstUserMessage || userInputText || '');

    if (!userId) {
      throw createRequestError(500, 'User context missing for authenticated request.');
    }

    const limitCheck = await services.rateLimitService.checkDailyLimit(userId, DAILY_REQUEST_LIMIT);

    if (!limitCheck.allowed) {
      throw createRequestError(429, 'Daily limit reached');
    }

    const runLockinFlow = async () => {
      let chatRecord;
      if (incomingChatId) {
        chatRecord = await services.chatRepository.getChatById(userId, incomingChatId);
        if (!chatRecord) {
          throw createRequestError(404, 'The requested chat does not exist for this user.');
        }
      } else {
        chatRecord = await services.chatRepository.createChat(userId, initialTitle);
      }

      const chatId = chatRecord.id;

      const userMessage = await services.chatRepository.insertChatMessage({
        chat_id: chatId,
        user_id: userId,
        role: 'user',
        mode: effectiveMode,
        source: 'highlight',
        input_text: userInputText,
        output_text: null,
      });

      const { processedAttachments, linkedAssetIds } =
        await services.chatAssetsService.resolveAttachmentsForMessage({
          userId,
          assetIds: attachments,
        });

      let structuredResponse;
      try {
        structuredResponse = await services.llmClient.generateStructuredStudyResponse({
          mode: effectiveMode,
          selection: trimmedSelection,
          pageContext,
          pageUrl,
          courseCode,
          language,
          chatHistory: sanitizedHistory,
          newUserMessage: trimmedUserMessage || undefined,
          attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
        });
      } catch (error) {
        services.logger.error({ err: error }, 'Error generating structured study response');
        throw createRequestError(
          500,
          error.message || 'Failed to generate study response. Please try again.',
        );
      }

      if (linkedAssetIds.length > 0 && userMessage?.id) {
        await services.chatAssetsService.linkAssetsToMessage(
          linkedAssetIds,
          userMessage.id,
          userId,
        );
      }

      await services.chatRepository.insertChatMessage({
        chat_id: chatId,
        user_id: userId,
        role: 'assistant',
        mode: effectiveMode,
        source: 'highlight',
        input_text: null,
        output_text: structuredResponse.explanation,
      });

      await services.chatRepository.touchChat(chatId);

      const existingTitle = typeof chatRecord.title === 'string' ? chatRecord.title.trim() : '';
      const shouldGenerateTitle =
        !existingTitle ||
        existingTitle === FALLBACK_TITLE ||
        existingTitle === initialTitleFromHistory;

      if (shouldGenerateTitle) {
        services.chatTitleService
          .generateChatTitleAsync(userId, chatId, firstUserMessage || userInputText)
          .catch((error) => {
            services.logger.warn({ err: error }, 'Failed to auto-generate chat title');
          });
      }

      return {
        success: true,
        data: {
          mode: structuredResponse.mode,
          explanation: structuredResponse.explanation,
          notes: structuredResponse.notes,
          todos: structuredResponse.todos,
          tags: structuredResponse.tags,
          difficulty: structuredResponse.difficulty,
        },
        chatId,
        chatTitle: existingTitle || initialTitle,
      };
    };

    if (idempotencyKey) {
      return services.idempotencyStore.run(idempotencyKey, userId, runLockinFlow);
    }

    return runLockinFlow();
  }

  return {
    handleLockinRequest,
  };
}

const assistantService = createAssistantService();

module.exports = {
  createAssistantService,
  assistantService,
};
