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
    // Payload is ALREADY validated by Zod middleware - no duplicate validation needed
    const {
      selection = '',
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

    // Determine request type based on chat history
    const isInitialRequest = chatHistory.length === 0;
    const effectiveMode = isInitialRequest ? mode : 'general';

    // Prepare text values
    const trimmedSelection = typeof selection === 'string' ? selection.trim() : '';
    const trimmedUserMessage = newUserMessage ? newUserMessage.trim() : '';
    const hasAttachmentIds = Array.isArray(attachments) && attachments.length > 0;

    // Build title seed
    const userInputText =
      trimmedUserMessage ||
      trimmedSelection ||
      (hasAttachmentIds ? ATTACHMENT_ONLY_TITLE_SEED : '');
    const initialTitle = buildInitialChatTitle(userInputText || '');
    const firstUserMessage = extractFirstUserMessage(chatHistory);
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
          chatHistory,
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
