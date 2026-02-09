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
    llmClient: deps.llmClient ?? { createChatCompletion },
    rateLimitService: deps.rateLimitService ?? { checkDailyLimit },
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
    chatTitleService: deps.chatTitleService ?? defaultChatTitleService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
  };

  async function handleLockinRequest({ userId, payload, idempotencyKey } = {}) {
    // Payload is ALREADY validated by Zod middleware - no duplicate validation needed
    const {
      selection,
      chatHistory,
      newUserMessage,
      incomingChatId,
      pageContext,
      pageUrl,
      courseCode,
      language,
      attachments,
      effectiveMode,
      trimmedSelection,
      trimmedUserMessage,
      userInputText,
      initialTitle,
      firstUserMessage,
      initialTitleFromHistory,
      regenerate,
    } = buildRequestContext(payload);

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

      const { processedAttachments, linkedAssetIds, pendingAssetIds } =
        await services.chatAssetsService.resolveAttachmentsForMessage({
          userId,
          assetIds: attachments,
        });

      if (pendingAssetIds.length > 0) {
        throw createRequestError(
          409,
          'Attachments are still processing. Please try again in a moment.',
        );
      }

      let userMessage;
      if (!regenerate) {
        userMessage = await services.chatRepository.insertChatMessage({
          chat_id: chatId,
          user_id: userId,
          role: 'user',
          mode: effectiveMode,
          source: 'highlight',
          input_text: userInputText,
          output_text: null,
        });
      }

      // Generate natural markdown response (industry standard - no forced JSON)
      let responseContent;
      try {
        const { messages } = buildStructuredStudyMessages({
          selection: trimmedSelection,
          pageContext,
          pageUrl,
          courseCode,
          language,
          chatHistory,
          newUserMessage: trimmedUserMessage || undefined,
          attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
        });

        const finalMessages = clampHistory(messages);

        const completion = await services.llmClient.createChatCompletion({
          messages: finalMessages,
          temperature: 0.4,
          maxTokens: 1500,
          // No responseFormat - returns natural markdown
          operation: 'chat.completions.create',
        });

        responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
          throw new Error('No response content from LLM');
        }
      } catch (error) {
        services.logger.error({ err: error }, 'Error generating AI response');
        throw createRequestError(
          500,
          error.message || 'Failed to generate study response. Please try again.',
        );
      }

      if (!regenerate && linkedAssetIds.length > 0 && userMessage?.id) {
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
        output_text: responseContent,
      });

      await services.chatRepository.touchChat(chatId);

      const existingTitle = typeof chatRecord.title === 'string' ? chatRecord.title.trim() : '';
      if (shouldGenerateTitle(existingTitle, initialTitleFromHistory)) {
        services.chatTitleService
          .generateChatTitleAsync(userId, chatId, firstUserMessage || userInputText)
          .catch((error) => {
            services.logger.warn({ err: error }, 'Failed to auto-generate chat title');
          });
      }

      // Return markdown content in consistent format
      // For backwards compatibility, wrap in data object with content field
      return {
        success: true,
        data: {
          content: responseContent,
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
