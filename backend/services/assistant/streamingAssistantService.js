/**
 * Streaming Assistant Service
 *
 * Handles streaming chat completion via SSE.
 * Streams content progressively as markdown (industry standard).
 *
 * Key Design Principles:
 * - NO forced JSON response format
 * - NO mode parameter affects LLM behavior (deprecated)
 * - Natural language (markdown) responses
 * - Simple content streaming
 *
 * @module services/assistant/streamingAssistantService
 */

const { randomUUID } = require('crypto');
const { chatCompletionStream } = require('../llm/providerChain');
const { buildStructuredStudyMessages } = require('../llm/structuredMessages');
const { clampHistory } = require('../llm/history');
const { createIdempotencyStore } = require('../../utils/idempotency');
const { buildRequestContext, shouldGenerateTitle } = require('./assistantFlow');
const chatRepository = require('../../repositories/chatRepository');
const { checkDailyLimit } = require('../rateLimitService');
const { chatAssetsService: defaultChatAssetsService } = require('./chatAssetsService');
const { chatTitleService: defaultChatTitleService } = require('./chatTitleService');

const DAILY_REQUEST_LIMIT = 100;
const defaultIdempotencyStore = createIdempotencyStore();

/**
 * Create the streaming assistant service with dependencies
 * @param {Object} [deps] - Injected dependencies (for testing)
 * @returns {Object} - Service instance
 */
function createStreamingAssistantService(deps = {}) {
  const services = {
    chatRepository: deps.chatRepository ?? chatRepository,
    rateLimitService: deps.rateLimitService ?? { checkDailyLimit },
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
    chatTitleService: deps.chatTitleService ?? defaultChatTitleService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
    chatCompletionStream: deps.chatCompletionStream ?? chatCompletionStream,
    logger: deps.logger ?? console,
  };

  /**
   * Handle streaming Lock-in request
   *
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {Object} params.payload - Request payload
   * @param {string} [params.idempotencyKey] - Optional idempotency key
   * @param {string} params.requestId - Request ID for tracking
   * @param {AbortSignal} params.signal - Abort signal for cancellation
   * @param {Object} params.sseWriter - SSE writer instance
   * @returns {Promise<void>}
   */
  async function handleLockinStreamRequest({
    userId,
    payload,
    idempotencyKey: _idempotencyKey,
    requestId,
    signal,
    sseWriter,
  }) {
    // Extract payload fields
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
    } = buildRequestContext(payload, 'Attachment analysis');

    if (!userId) {
      throw Object.assign(new Error('User context missing for authenticated request.'), {
        statusCode: 500,
        code: 'AUTH_ERROR',
      });
    }

    const idempotencyKey = _idempotencyKey;
    if (idempotencyKey) {
      const beginResult = await services.idempotencyStore.begin(idempotencyKey, userId);

      if (beginResult.status === 'completed' && beginResult.response) {
        const cachedResponse = beginResult.response;
        const cachedChatId = cachedResponse.chatId || incomingChatId || randomUUID();
        const cachedMessageId = randomUUID();

        sseWriter.writeMeta({
          chatId: cachedChatId,
          messageId: cachedMessageId,
          requestId,
          model: 'cached',
          provider: 'idempotency',
        });

        const cachedContent = cachedResponse?.data?.content || '';
        if (cachedContent) {
          sseWriter.writeFinal(cachedContent, cachedResponse?.data?.usage || null);
        } else {
          sseWriter.writeError('IDEMPOTENCY_EMPTY', 'Cached response was empty', false);
        }
        sseWriter.end();
        return;
      }

      if (beginResult.status === 'in_progress') {
        throw Object.assign(new Error('Request is already in progress. Please retry shortly.'), {
          statusCode: 409,
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      }
    }

    // Check rate limit
    const limitCheck = await services.rateLimitService.checkDailyLimit(userId, DAILY_REQUEST_LIMIT);
    if (!limitCheck.allowed) {
      throw Object.assign(new Error('Daily limit reached'), {
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // Get or create chat
    let chatRecord;
    if (incomingChatId) {
      chatRecord = await services.chatRepository.getChatById(userId, incomingChatId);
      if (!chatRecord) {
        throw Object.assign(new Error('The requested chat does not exist for this user.'), {
          statusCode: 404,
          code: 'CHAT_NOT_FOUND',
        });
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
      throw Object.assign(new Error('Attachments are still processing. Please try again.'), {
        statusCode: 409,
        code: 'ASSETS_PROCESSING',
      });
    }

    // Insert user message — SKIP for regeneration requests.
    // When regenerate=true, the canonical timeline already has the user message
    // (from the edit/regenerate truncation flow). Inserting again would create a
    // duplicate row in the database.
    let userMessage = null;
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

    // Link assets to user message (only if we created one)
    if (!regenerate && linkedAssetIds.length > 0 && userMessage?.id) {
      await services.chatAssetsService.linkAssetsToMessage(linkedAssetIds, userMessage.id, userId);
    }

    // Build messages for LLM (mode is not passed - LLM infers intent from context)
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

    // Generate assistant message ID before streaming
    // This allows client to track the message during streaming
    const assistantMessageId = randomUUID();

    // Send meta event with request context
    sseWriter.writeMeta({
      chatId,
      messageId: assistantMessageId,
      requestId,
      model: 'gemini-2.0-flash', // Will be updated in final from actual response
      provider: 'gemini',
    });

    // Stream the response
    let accumulatedContent = '';
    let usage = null;
    let actualModel = null;
    let actualProvider = null;
    let shouldStop = false;

    try {
      const stream = services.chatCompletionStream({
        messages: finalMessages,
        temperature: 0.4,
        maxTokens: 4096,
        // No responseFormat - LLM returns natural markdown (industry standard)
        operation: 'chat.completions.stream',
      });

      for await (const chunk of stream) {
        // Check for abort
        if (signal?.aborted) {
          services.logger.info('[StreamingAssistant] Request aborted by client');
          break;
        }

        // Handle different chunk types
        switch (chunk.type) {
          case 'delta':
            accumulatedContent += chunk.content;
            {
              const ok = sseWriter.writeDelta(chunk.content);
              if (!ok) {
                const drained = await sseWriter.waitForDrain();
                if (!drained || signal?.aborted) {
                  services.logger.info('[StreamingAssistant] Stream backpressure abort');
                  shouldStop = true;
                  break;
                }
              }
            }
            break;

          case 'final':
            // Final chunk provides the complete content and usage
            accumulatedContent = chunk.content || accumulatedContent;
            usage = chunk.usage || null;
            actualModel = chunk.model || actualModel;
            actualProvider = chunk.provider || actualProvider;
            break;

          case 'meta':
            // Update meta info from provider
            actualModel = chunk.model || actualModel;
            actualProvider = chunk.provider || actualProvider;
            break;

          case 'error':
            // Stream error from provider
            throw Object.assign(new Error(chunk.message || 'Stream error'), {
              statusCode: 500,
              code: chunk.code || 'STREAM_ERROR',
            });
        }

        if (shouldStop) {
          break;
        }
      }
    } catch (error) {
      services.logger.error('[StreamingAssistant] Stream error:', {
        error: error.message,
        chatId,
        requestId,
      });

      if (idempotencyKey) {
        await services.idempotencyStore.fail(idempotencyKey, userId);
      }

      // Re-throw for controller to handle
      throw error;
    }

    // If aborted, don't save the message
    if (signal?.aborted) {
      return;
    }

    // Content is already in markdown format (no JSON parsing needed)
    const responseContent = accumulatedContent;

    // Send final event with complete data
    sseWriter.writeFinal(responseContent, usage);

    // Save assistant message to database
    await services.chatRepository.insertChatMessage({
      chat_id: chatId,
      user_id: userId,
      role: 'assistant',
      mode: effectiveMode, // Kept for backwards compatibility with DB schema
      source: 'highlight',
      input_text: null,
      output_text: responseContent,
      metadata: {
        messageId: assistantMessageId,
        usage,
        model: actualModel,
        provider: actualProvider,
      },
    });

    // Update chat timestamp
    await services.chatRepository.touchChat(chatId);

    // Auto-generate title if needed
    const existingTitle = typeof chatRecord.title === 'string' ? chatRecord.title.trim() : '';
    const shouldAutoTitle = shouldGenerateTitle(existingTitle, initialTitleFromHistory);
    if (shouldAutoTitle) {
      services.chatTitleService
        .generateChatTitleAsync(userId, chatId, firstUserMessage || userInputText)
        .catch((error) => {
          services.logger.warn('[StreamingAssistant] Failed to auto-generate chat title:', error);
        });
    }

    if (idempotencyKey) {
      await services.idempotencyStore.complete(idempotencyKey, userId, {
        success: true,
        data: {
          content: responseContent,
          usage,
        },
        chatId,
        chatTitle: existingTitle || initialTitle,
      });
    }
  }

  return {
    handleLockinStreamRequest,
  };
}

const streamingAssistantService = createStreamingAssistantService();

module.exports = {
  createStreamingAssistantService,
  streamingAssistantService,
};
