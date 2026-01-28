/**
 * Route handlers for the Lock-in API.
 *
 * These controllers contain no Express wiring so they are easy to unit test.
 */

const {
  generateStructuredStudyResponse,
  generateChatTitleFromHistory,
} = require('../openaiClient');
const { supabase } = require('../supabaseClient');
const {
  createChat,
  getChatById,
  insertChatMessage,
  touchChat,
  getRecentChats,
  getChatMessages,
  updateChatTitle,
} = require('../chatRepository');
const {
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
  DEFAULT_CHAT_LIST_LIMIT,
  MAX_CHAT_LIST_LIMIT,
} = require('../config');
const { checkDailyLimit } = require('../rateLimiter');
const {
  validateMode,
  validateUUID,
  validateChatHistory,
  validateText,
} = require('../utils/validation');
const {
  buildInitialChatTitle,
  extractFirstUserMessage,
  FALLBACK_TITLE,
} = require('../utils/chatTitle');
const {
  getAssetForVision,
  getAssetTextContent,
  createSignedAssetUrl,
} = require('./chatAssetsController');
const { isVisionCompatibleImage } = require('../utils/chatAssetValidation');
const chatAssetsRepository = require('../repositories/chatAssetsRepository');
const { createIdempotencyStore } = require('../utils/idempotency');

const ATTACHMENT_ONLY_TITLE_SEED = 'Attachment-based question';
const idempotencyStore = createIdempotencyStore();

function extractIdempotencyKey(req) {
  const headerValue =
    (typeof req.get === 'function' && req.get('Idempotency-Key')) ||
    req.headers?.['idempotency-key'];
  const bodyValue = req.body?.idempotencyKey;
  const candidate =
    (typeof headerValue === 'string' && headerValue.trim()) ||
    (typeof bodyValue === 'string' && bodyValue.trim());
  return candidate || null;
}

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

function parseChatCursor(rawCursor) {
  if (typeof rawCursor !== 'string') return null;
  const trimmed = rawCursor.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    const ms = trimmed.length <= 10 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

/**
 * GET /api/chats
 * List recent chats for the authenticated user.
 */
async function listChats(req, res) {
  try {
    const userId = req.user?.id;
    const requestedLimit = parseInt(req.query.limit, 10);
    const cursorParam = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    const cursor = parseChatCursor(cursorParam);

    if (cursorParam && !cursor) {
      return res.status(400).json({ error: 'Invalid cursor parameter' });
    }

    // Validate and constrain limit
    let limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_CHAT_LIST_LIMIT)
        : DEFAULT_CHAT_LIST_LIMIT;

    const { chats, pagination } = await getRecentChats(userId, { limit, cursor });

    const response = chats.map((chat) => ({
      ...chat,
      // Return null for empty titles so frontend can handle fallback/generation
      title: chat.title && chat.title.trim() ? chat.title : null,
    }));

    return res.json({
      chats: response,
      pagination,
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({ error: 'Failed to load chats' });
  }
}

/**
 * POST /api/chats
 * Create a new chat session for the authenticated user.
 */
async function createChatSession(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(500).json({ error: 'User context missing.' });
    }

    const { title, initialMessage } = req.body || {};
    const seed =
      typeof title === 'string' && title.trim().length > 0
        ? title
        : typeof initialMessage === 'string'
          ? initialMessage
          : '';
    const chatTitle = buildInitialChatTitle(seed);

    const chat = await createChat(userId, chatTitle);

    return res.status(201).json({
      id: chat.id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      lastMessageAt: chat.last_message_at,
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({ error: 'Failed to create chat' });
  }
}

/**
 * DELETE /api/chats/:chatId
 * Soft‑enforced delete of a chat and its messages (scoped to the user).
 */
async function deleteChat(req, res) {
  try {
    const userId = req.user?.id;
    const chatId = req.params.chatId;

    // Validate chatId format
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: chatIdValidation.error,
      });
    }

    // Verify the chat belongs to the user
    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested chat does not exist for this user',
      });
    }

    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (messagesError) {
      console.error('Error deleting chat messages:', messagesError);
      return res.status(500).json({
        error: 'Failed to delete chat messages',
      });
    }

    const { error: chatError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);

    if (chatError) {
      console.error('Error deleting chat:', chatError);
      return res.status(500).json({
        error: 'Failed to delete chat',
      });
    }

    return res.status(200).json({
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    console.error('Error in delete chat endpoint:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete chat',
    });
  }
}

/**
 * GET /api/chats/:chatId/messages
 * List all messages in a chat owned by the authenticated user.
 */
async function listChatMessages(req, res) {
  try {
    const userId = req.user?.id;
    const { chatId } = req.params;

    // Validate chatId format
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: chatIdValidation.error,
      });
    }

    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await getChatMessages(userId, chatId);
    const assets = await chatAssetsRepository.listAssetsForChat(chatId, userId);
    const assetsByMessage = new Map();

    if (assets.length > 0) {
      const assetsWithUrls = await Promise.all(
        assets.map(async (asset) => ({
          id: asset.id,
          messageId: asset.message_id,
          kind: asset.type,
          mime: asset.mime_type,
          name: asset.file_name || 'Attachment',
          url: await createSignedAssetUrl(asset.storage_path),
        })),
      );

      for (const asset of assetsWithUrls) {
        if (!asset.messageId) continue;
        if (!assetsByMessage.has(asset.messageId)) {
          assetsByMessage.set(asset.messageId, []);
        }
        assetsByMessage.get(asset.messageId).push(asset);
      }
    }

    const response = messages.map((message) => {
      const attachments = assetsByMessage.get(message.id);
      if (!attachments || attachments.length === 0) {
        return message;
      }
      return { ...message, attachments };
    });

    return res.json(response);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return res.status(500).json({ error: 'Failed to load chat messages' });
  }
}

/**
 * Helper function to generate chat title asynchronously (non-blocking)
 * Used for automatic title generation after chat messages
 */
async function generateChatTitleAsync(userId, chatId, fallbackText = '') {
  try {
    const messages = await getChatMessages(userId, chatId);

    const normalizedHistory = (messages || [])
      .map((message) => {
        const content =
          (typeof message.content === 'string' && message.content.trim()) ||
          (typeof message.input_text === 'string' && message.input_text.trim()) ||
          (typeof message.output_text === 'string' && message.output_text.trim()) ||
          '';

        if (!content) return null;

        return {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: content.trim(),
        };
      })
      .filter(Boolean);

    // Need at least one user message and one assistant message to generate a meaningful title
    const hasUser = normalizedHistory.some((message) => message.role === 'user');
    const hasAssistant = normalizedHistory.some((message) => message.role === 'assistant');

    if (normalizedHistory.length < 2 || !hasUser || !hasAssistant) {
      return;
    }

    const fallbackTitle = buildInitialChatTitle(
      extractFirstUserMessage(messages) || fallbackText || '',
    );

    const generatedTitle = await generateChatTitleFromHistory({
      history: normalizedHistory,
      fallbackTitle,
    });

    await updateChatTitle(userId, chatId, generatedTitle);
  } catch (error) {
    console.error('Error in async title generation:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * POST /api/chats/:chatId/title
 * Generate and persist a short chat title using OpenAI, with a safe fallback.
 */
async function generateChatTitle(req, res) {
  const userId = req.user?.id;
  const { chatId } = req.params;
  let fallbackTitle = FALLBACK_TITLE;

  try {
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: chatIdValidation.error },
      });
    }

    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: { message: 'Chat not found' } });
    }

    const messages = await getChatMessages(userId, chatId);

    const normalizedHistory = (messages || [])
      .map((message) => {
        const content =
          (typeof message.content === 'string' && message.content.trim()) ||
          (typeof message.input_text === 'string' && message.input_text.trim()) ||
          (typeof message.output_text === 'string' && message.output_text.trim()) ||
          '';

        if (!content) return null;

        return {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: content.trim(),
        };
      })
      .filter(Boolean);

    fallbackTitle = buildInitialChatTitle(extractFirstUserMessage(messages) || chat.title || '');

    const generatedTitle = await generateChatTitleFromHistory({
      history: normalizedHistory,
      fallbackTitle,
    });

    const stored = await updateChatTitle(userId, chatId, generatedTitle);

    return res.json({
      success: true,
      chatId,
      title: stored?.title || generatedTitle,
    });
  } catch (error) {
    console.error('Error generating chat title:', error);
    const safeTitle = buildInitialChatTitle(fallbackTitle || FALLBACK_TITLE);
    try {
      if (userId && chatId) {
        await updateChatTitle(userId, chatId, safeTitle);
      }
    } catch (storageError) {
      console.error('Failed to persist fallback chat title:', storageError);
    }

    return res.status(200).json({
      success: true,
      chatId,
      title: safeTitle,
    });
  }
}

module.exports = {
  handleLockinRequest,
  createChatSession,
  listChats,
  deleteChat,
  listChatMessages,
  generateChatTitle,
};
