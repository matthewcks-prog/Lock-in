/**
 * Lock-in Backend Server
 * Express API that handles AI-powered text processing for the Chrome extension
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { generateLockInResponse } = require("./openaiClient");
const { requireSupabaseUser } = require("./authMiddleware");
const { checkDailyLimit } = require("./rateLimiter");
const { supabase } = require("./supabaseClient");
const {
  createChat,
  getChatById,
  insertChatMessage,
  touchChat,
  getRecentChats,
  getChatMessages,
} = require("./chatRepository");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SELECTION_LENGTH = 5000;
const MAX_USER_MESSAGE_LENGTH = 1500;
const DAILY_REQUEST_LIMIT =
  parseInt(process.env.DAILY_REQUEST_LIMIT, 10) || 100;
const DEFAULT_CHAT_LIST_LIMIT = parseInt(process.env.CHAT_LIST_LIMIT, 10) || 5;

// Middleware
app.use(express.json());

// CORS configuration - allow requests from Chrome extension
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests from Chrome extensions and localhost
      if (
        !origin ||
        origin.startsWith("chrome-extension://") ||
        origin.includes("localhost")
      ) {
        callback(null, true);
      } else {
        callback(null, true); // In production, you'd want to restrict this
      }
    },
    credentials: true,
  })
);

// Request logging middleware (production-safe)
app.use((req, res, next) => {
  const selection = req.body?.selection || req.body?.text;
  const chatLength = Array.isArray(req.body?.chatHistory)
    ? req.body.chatHistory.length
    : 0;

  if (selection || chatLength) {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - Mode: ${
        req.body?.mode || "n/a"
      }, Selection length: ${
        selection ? selection.length : 0
      }, Chat messages: ${chatLength}`
    );
  }
  next();
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Lock-in API is running" });
});

/**
 * Main API endpoint for Lock-in extension
 * POST /api/lockin
 */
app.post("/api/lockin", requireSupabaseUser, async (req, res) => {
  try {
    const {
      selection: selectionFromBody,
      text: legacyText,
      mode,
      targetLanguage = "en",
      difficultyLevel = "highschool",
      chatHistory = [],
      newUserMessage,
      chatId: incomingChatId,
    } = req.body;

    const selection = (selectionFromBody || legacyText || "").trim();

    // Validation: mode must be valid
    const validModes = ["explain", "simplify", "translate"];
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Mode must be one of: ${validModes.join(", ")}`,
      });
    }

    const sanitizedHistory = Array.isArray(chatHistory) ? chatHistory : [];
    const isInitialRequest = sanitizedHistory.length === 0;

    if (isInitialRequest && selection.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Selection is required for the first message.",
      });
    }

    if (selection && selection.length > MAX_SELECTION_LENGTH) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Selection is too long. Maximum ${MAX_SELECTION_LENGTH} characters.`,
      });
    }

    const trimmedUserMessage =
      typeof newUserMessage === "string" ? newUserMessage.trim() : "";

    if (
      trimmedUserMessage &&
      trimmedUserMessage.length > MAX_USER_MESSAGE_LENGTH
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Follow-up questions are too long. Maximum ${MAX_USER_MESSAGE_LENGTH} characters.`,
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "User context missing for authenticated request.",
      });
    }

    const limitCheck = await checkDailyLimit(userId, DAILY_REQUEST_LIMIT);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: "Daily limit reached",
        limit: DAILY_REQUEST_LIMIT,
      });
    }

    let chatRecord;
    if (incomingChatId) {
      chatRecord = await getChatById(userId, incomingChatId);
      if (!chatRecord) {
        return res.status(404).json({
          error: "Chat not found",
          message: "The requested chat does not exist for this user.",
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
      mode,
      source: "highlight",
      input_text: userInputText,
      output_text: null,
    });

    const aiResponse = await generateLockInResponse({
      selection,
      mode,
      targetLanguage,
      difficultyLevel,
      chatHistory: sanitizedHistory,
      newUserMessage: trimmedUserMessage,
    });

    const promptTokens = aiResponse.usage?.prompt_tokens ?? 0;
    const completionTokens = aiResponse.usage?.completion_tokens ?? 0;

    await insertChatMessage({
      chat_id: chatId,
      user_id: userId,
      role: "assistant",
      mode,
      source: "highlight",
      input_text: null,
      output_text: aiResponse.answer,
    });

    await touchChat(chatId);

    supabase
      .from("ai_requests")
      .insert([
        {
          user_id: userId,
          mode,
          tokens_in: promptTokens,
          tokens_out: completionTokens,
        },
      ])
      .then(() => {})
      .catch((logError) => {
        console.error("Failed to log ai_requests row:", logError.message);
      });

    res.json({
      chatId,
      mode,
      targetLanguage,
      difficultyLevel,
      answer: aiResponse.answer,
      chatHistory: aiResponse.chatHistory,
      usage: aiResponse.usage,
    });
  } catch (error) {
    console.error("Error processing request:", error.message);

    // Don't expose internal errors to client
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to process your request. Please try again.",
    });
  }
});

/**
 * List recent chats for the authenticated user.
 */
app.get("/api/chats", requireSupabaseUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? requestedLimit
      : DEFAULT_CHAT_LIST_LIMIT;

    const chats = await getRecentChats(userId, limit);

    const response = chats.map((chat) => ({
      ...chat,
      title:
        chat.title ||
        `Chat from ${new Date(chat.created_at).toISOString().split("T")[0]}`,
    }));

    res.json(response);
  } catch (error) {
    console.error("Error fetching chats:", error.message);
    res.status(500).json({ error: "Failed to load chats" });
  }
});

/**
 * List all messages for a chat owned by the authenticated user.
 */
app.get(
  "/api/chats/:chatId/messages",
  requireSupabaseUser,
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { chatId } = req.params;

      const chat = await getChatById(userId, chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const messages = await getChatMessages(userId, chatId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error.message);
      res.status(500).json({ error: "Failed to load chat messages" });
    }
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Lock-in backend server running on http://localhost:${PORT}`);
  console.log(`Ready to help students learn!`);

  if (!process.env.OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY not found in environment variables!");
    console.warn("   Please create a .env file with your OpenAI API key.");
  }
});
