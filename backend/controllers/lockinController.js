/**
 * Route handlers for the Lock-in API.
 *
 * These controllers contain no Express wiring so they are easy to unit test.
 */

const {
  generateLockInResponse,
  generateStructuredStudyResponse,
} = require("../openaiClient");
const { supabase } = require("../supabaseClient");
const {
  createChat,
  getChatById,
  insertChatMessage,
  touchChat,
  getRecentChats,
  getChatMessages,
} = require("../chatRepository");
const {
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
  DEFAULT_CHAT_LIST_LIMIT,
} = require("../config");
const { checkDailyLimit } = require("../rateLimiter");
const {
  validateMode,
  validateLanguageCode,
  validateDifficultyLevel,
  validateUUID,
  validateChatHistory,
  validateText,
} = require("../utils/validation");

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
      difficultyLevel = "highschool",
      chatHistory = [],
      newUserMessage,
      chatId: incomingChatId,
      pageContext,
      pageUrl,
      courseCode,
      language = "en",
    } = req.body || {};

    // Validate mode
    const modeValidation = validateMode(mode);
    if (!modeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: modeValidation.error },
      });
    }

    // Validate difficulty level
    const difficultyValidation = validateDifficultyLevel(difficultyLevel);
    if (!difficultyValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: difficultyValidation.error },
      });
    }
    const normalizedDifficulty = difficultyValidation.normalized;

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
    const effectiveMode = isInitialRequest ? mode : "general";

    // Validate selection (required for initial request)
    const selection = selectionFromBody || legacyText || "";
    if (isInitialRequest) {
      if (!selection || selection.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: "Selection is required for initial requests" },
        });
      }
      const selectionValidation = validateText(selection, MAX_SELECTION_LENGTH, "Selection");
      if (!selectionValidation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: selectionValidation.error },
        });
      }
    } else if (selection) {
      // Optional for follow-up messages, but validate if provided
      const selectionValidation = validateText(selection, MAX_SELECTION_LENGTH, "Selection");
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
        error: { message: "Mode is required" },
      });
    }

    // Validate new user message if provided
    let trimmedUserMessage = "";
    if (newUserMessage) {
      const messageValidation = validateText(newUserMessage, MAX_USER_MESSAGE_LENGTH, "Follow-up message");
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

    if (!userId) {
      // This should not happen if requireSupabaseUser is working correctly
      return res.status(500).json({
        success: false,
        error: { message: "User context missing for authenticated request." },
      });
    }

    const limitCheck = await checkDailyLimit(userId, DAILY_REQUEST_LIMIT);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: { message: "Daily limit reached" },
      });
    }

    let chatRecord;
    if (incomingChatId) {
      chatRecord = await getChatById(userId, incomingChatId);
      if (!chatRecord) {
        return res.status(404).json({
          success: false,
          error: { message: "The requested chat does not exist for this user." },
        });
      }
    } else {
      chatRecord = await createChat(userId);
    }

    const chatId = chatRecord.id;
    const userInputText = trimmedUserMessage || selection;

    await insertChatMessage({
      chat_id: chatId,
      user_id: userId,
      role: "user",
      mode: effectiveMode,
      source: "highlight",
      input_text: userInputText,
      output_text: null,
    });

    // Use structured response for initial requests (no chat history or new selection)
    // For follow-up messages with existing chat history, we still use the structured response
    // but the model will generate based on the selection and context
    // Selection is required for generateStructuredStudyResponse (even for follow-ups, it's the original selection)
    const trimmedSelection = selection.trim();
    if (!trimmedSelection) {
      return res.status(400).json({
        success: false,
        error: { message: "Selection is required. Please provide the original selected text." },
      });
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
        difficultyLevel: normalizedDifficulty,
        chatHistory: sanitizedHistory,
        newUserMessage: trimmedUserMessage || undefined,
      });
    } catch (error) {
      console.error("Error generating structured study response:", error);
      return res.status(500).json({
        success: false,
        error: { message: error.message || "Failed to generate study response. Please try again." },
      });
    }

    // Store the explanation as the output text (for now, we don't persist notes/todos yet)
    await insertChatMessage({
      chat_id: chatId,
      user_id: userId,
      role: "assistant",
      mode: effectiveMode,
      source: "highlight",
      input_text: null,
      output_text: structuredResponse.explanation,
    });

    await touchChat(chatId);

    // For now, we don't log token usage from structured responses
    // This can be added later if needed

    return res.json({
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
    });
  } catch (error) {
    console.error("Error processing /api/lockin request:", error);

    // Don't expose internal errors to client
    return res.status(500).json({
      success: false,
      error: { message: "Failed to process your request. Please try again." },
    });
  }
}

/**
 * GET /api/chats
 * List recent chats for the authenticated user.
 */
async function listChats(req, res) {
  try {
    const userId = req.user?.id;
    const requestedLimit = parseInt(req.query.limit, 10);
    
    // Validate and constrain limit
    let limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100) // Cap at 100
      : DEFAULT_CHAT_LIST_LIMIT;

    const chats = await getRecentChats(userId, limit);

    const response = chats.map((chat) => ({
      ...chat,
      title:
        chat.title ||
        `Chat from ${new Date(chat.created_at).toISOString().split("T")[0]}`,
    }));

    return res.json(response);
  } catch (error) {
    console.error("Error fetching chats:", error);
    return res.status(500).json({ error: "Failed to load chats" });
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
        error: "Bad Request",
        message: chatIdValidation.error,
      });
    }

    // Verify the chat belongs to the user
    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({
        error: "Not Found",
        message: "The requested chat does not exist for this user",
      });
    }

    const { error: messagesError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("chat_id", chatId)
      .eq("user_id", userId);

    if (messagesError) {
      console.error("Error deleting chat messages:", messagesError);
      return res.status(500).json({
        error: "Failed to delete chat messages",
      });
    }

    const { error: chatError } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId)
      .eq("user_id", userId);

    if (chatError) {
      console.error("Error deleting chat:", chatError);
      return res.status(500).json({
        error: "Failed to delete chat",
      });
    }

    return res.status(200).json({
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Error in delete chat endpoint:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete chat",
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
        error: "Bad Request",
        message: chatIdValidation.error,
      });
    }

    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const messages = await getChatMessages(userId, chatId);
    return res.json(messages);
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return res.status(500).json({ error: "Failed to load chat messages" });
  }
}

module.exports = {
  handleLockinRequest,
  listChats,
  deleteChat,
  listChatMessages,
};


