/**
 * Route handlers for the Lock-in assistant AI endpoints.
 *
 * These controllers contain no Express wiring so they are easy to unit test.
 */

const { generateStructuredStudyResponse } = require('../../openaiClient');
const { createChat, getChatById, insertChatMessage, touchChat } = require('../../chatRepository');
const {
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
} = require('../../config');
const { checkDailyLimit } = require('../../rateLimiter');
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
const { getAssetForVision, getAssetTextContent } = require('./assets');
const { isVisionCompatibleImage } = require('../../utils/chatAssetValidation');
const chatAssetsRepository = require('../../repositories/chatAssetsRepository');
const { createIdempotencyStore } = require('../../utils/idempotency');
const { extractIdempotencyKey } = require('../../utils/idempotencyKey');
const { generateChatTitleAsync } = require('./title');

const ATTACHMENT_ONLY_TITLE_SEED = 'Attachment-based question';
const idempotencyStore = createIdempotencyStore();

function createRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.payload = {
    success: false,
    error: { message },
  };
  return error;
}

/**
 * POST /api/lockin
 * Main endpoint used by the Chrome extension for AI assistance.
 *
 * GOAL
 * ----
 * Update this controller to call generateStructuredStudyResponse instead of the old
 * explain/simplify/translate helpers.
 *
 * - Read from req.body:
 *    - mode: "explain" | "general"
 *    - selection: string (required)
 *    - pageContext?: string
 *    - pageUrl?: string
 *    - courseCode?: string
 *    - language?: string
 *
 * - Call openaiClient.generateStructuredStudyResponse({ ...options })
 *   and wait for the result.
 *
 * - Return a JSON response like:
 *   {
 *     success: true,
 *     data: { mode, explanation, notes, todos, tags, difficulty }
 *   }
 *
 * - On error, log the error and return:
 *   {
 *     success: false,
 *     error: { message: "User-friendly message" }
 *   }
 *
 * - Keep auth + rate limiting behavior exactly the same as before.
 * - For now, do NOT persist notes/todos yet; just pass them back to the extension.
 *   We will hook up database persistence in a later step.
 */
async function handleLockinRequest(req, res) {
  try {
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
      attachments = [], // Array of asset IDs to include in the message
    } = req.body || {};

    // Validate mode
    const modeValidation = validateMode(mode);
    if (!modeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: modeValidation.error },
      });
    }

    // Validate and sanitize chat history
    const historyValidation = validateChatHistory(chatHistory);
    if (!historyValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: historyValidation.error },
      });
    }
    const sanitizedHistory = historyValidation.sanitized;
    const isInitialRequest = sanitizedHistory.length === 0;

    // Use the selected mode for the first answer, then general chat for follow-ups
    const effectiveMode = isInitialRequest ? mode : 'general';

    // Validate selection (required for initial request)
    const selection = selectionFromBody || legacyText || '';
    const trimmedSelection = typeof selection === 'string' ? selection.trim() : '';
    const hasAttachmentIds = Array.isArray(attachments) && attachments.length > 0;
    if (isInitialRequest) {
      if (!trimmedSelection && !hasAttachmentIds) {
        return res.status(400).json({
          success: false,
          error: { message: 'Selection or attachments are required for initial requests' },
        });
      }
      if (trimmedSelection) {
        const selectionValidation = validateText(selection, MAX_SELECTION_LENGTH, 'Selection');
        if (!selectionValidation.valid) {
          return res.status(400).json({
            success: false,
            error: { message: selectionValidation.error },
          });
        }
      }
    } else if (trimmedSelection) {
      // Optional for follow-up messages, but validate if provided
      const selectionValidation = validateText(selection, MAX_SELECTION_LENGTH, 'Selection');
      if (!selectionValidation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: selectionValidation.error },
        });
      }
    }

    // Validate mode exists
    if (!mode) {
      return res.status(400).json({
        success: false,
        error: { message: 'Mode is required' },
      });
    }

    // Validate new user message if provided
    let trimmedUserMessage = '';
    if (newUserMessage) {
      const messageValidation = validateText(
        newUserMessage,
        MAX_USER_MESSAGE_LENGTH,
        'Follow-up message',
      );
      if (!messageValidation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: messageValidation.error },
        });
      }
      trimmedUserMessage = messageValidation.sanitized;
    }

    // Validate chatId if provided
    if (incomingChatId) {
      const chatIdValidation = validateUUID(incomingChatId);
      if (!chatIdValidation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: chatIdValidation.error },
        });
      }
    }

    const userId = req.user?.id;
    const userInputText =
      trimmedUserMessage ||
      trimmedSelection ||
      (hasAttachmentIds ? ATTACHMENT_ONLY_TITLE_SEED : '');
    const initialTitle = buildInitialChatTitle(userInputText || '');
    const firstUserMessage = extractFirstUserMessage(sanitizedHistory);
    const initialTitleFromHistory = buildInitialChatTitle(firstUserMessage || userInputText || '');

    if (!userId) {
      // This should not happen if requireSupabaseUser is working correctly
      return res.status(500).json({
        success: false,
        error: { message: 'User context missing for authenticated request.' },
      });
    }

    const limitCheck = await checkDailyLimit(userId, DAILY_REQUEST_LIMIT);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: { message: 'Daily limit reached' },
      });
    }

    const idempotencyKey = extractIdempotencyKey(req);

    const runLockinFlow = async () => {
      let chatRecord;
      if (incomingChatId) {
        chatRecord = await getChatById(userId, incomingChatId);
        if (!chatRecord) {
          throw createRequestError(404, 'The requested chat does not exist for this user.');
        }
      } else {
        chatRecord = await createChat(userId, initialTitle);
      }

      const chatId = chatRecord.id;

      const userMessage = await insertChatMessage({
        chat_id: chatId,
        user_id: userId,
        role: 'user',
        mode: effectiveMode,
        source: 'highlight',
        input_text: userInputText,
        output_text: null,
      });

      // Process attachments for vision/text extraction
      const processedAttachments = [];
      const linkedAssetIds = [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const assetId of attachments.slice(0, 5)) {
          // Limit to 5 attachments
          // Validate asset ID format
          const assetIdValidation = validateUUID(assetId);
          if (!assetIdValidation.valid) continue;

          // Get asset metadata
          const asset = await chatAssetsRepository.getAssetById(assetId, userId);
          if (!asset) continue;
          linkedAssetIds.push(asset.id);

          if (isVisionCompatibleImage(asset.mime_type)) {
            // Get base64 data for vision
            const visionData = await getAssetForVision(assetId, userId);
            if (visionData) {
              processedAttachments.push({
                type: 'image',
                mimeType: visionData.mimeType,
                base64: visionData.base64,
                fileName: visionData.fileName,
              });
            }
          } else {
            // Get text content for documents/code
            const textData = await getAssetTextContent(assetId, userId);
            if (textData && textData.textContent) {
              processedAttachments.push({
                type: asset.type,
                mimeType: textData.mimeType,
                textContent: textData.textContent,
                fileName: textData.fileName,
              });
            }
          }
        }
      }

      let structuredResponse;
      try {
        structuredResponse = await generateStructuredStudyResponse({
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
        console.error('Error generating structured study response:', error);
        throw createRequestError(
          500,
          error.message || 'Failed to generate study response. Please try again.',
        );
      }

      // Link attachments to the user message if we have a chat
      if (linkedAssetIds.length > 0 && userMessage?.id) {
        await chatAssetsRepository.linkAssetsToMessage(linkedAssetIds, userMessage.id, userId);
      }

      // Store the explanation as the output text (for now, we don't persist notes/todos yet)
      await insertChatMessage({
        chat_id: chatId,
        user_id: userId,
        role: 'assistant',
        mode: effectiveMode,
        source: 'highlight',
        input_text: null,
        output_text: structuredResponse.explanation,
      });

      await touchChat(chatId);

      // Automatically generate AI title if chat doesn't have one yet (or has fallback)
      // Do this asynchronously to avoid blocking the response
      const existingTitle = typeof chatRecord.title === 'string' ? chatRecord.title.trim() : '';
      const shouldGenerateTitle =
        !existingTitle ||
        existingTitle === FALLBACK_TITLE ||
        existingTitle === initialTitleFromHistory;

      if (shouldGenerateTitle) {
        // Generate title asynchronously (fire and forget)
        generateChatTitleAsync(userId, chatId, firstUserMessage || userInputText).catch((error) => {
          console.error('Failed to auto-generate chat title:', error);
          // Non-critical error, don't throw
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

    const responsePayload = idempotencyKey
      ? await idempotencyStore.run(idempotencyKey, userId, runLockinFlow)
      : await runLockinFlow();

    return res.json(responsePayload);
  } catch (error) {
    console.error('Error processing /api/lockin request:', error);

    if (error?.status && error?.payload) {
      return res.status(error.status).json(error.payload);
    }

    // Don't expose internal errors to client
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to process your request. Please try again.' },
    });
  }
}

module.exports = {
  handleLockinRequest,
};
