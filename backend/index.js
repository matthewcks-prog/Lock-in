/**
 * Lock-in Backend Server
 * Express API that handles AI-powered text processing for the Chrome extension
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { generateLockInResponse } = require("./openaiClient");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SELECTION_LENGTH = 5000;
const MAX_USER_MESSAGE_LENGTH = 1500;

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
app.post("/api/lockin", async (req, res) => {
  try {
    const {
      selection: selectionFromBody,
      text: legacyText,
      mode,
      targetLanguage = "en",
      difficultyLevel = "highschool",
      chatHistory = [],
      newUserMessage,
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

    const aiResponse = await generateLockInResponse({
      selection,
      mode,
      targetLanguage,
      difficultyLevel,
      chatHistory: sanitizedHistory,
      newUserMessage: trimmedUserMessage,
    });

    res.json({
      mode,
      targetLanguage,
      difficultyLevel,
      answer: aiResponse.answer,
      chatHistory: aiResponse.chatHistory,
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Lock-in backend server running on http://localhost:${PORT}`);
  console.log(`📚 Ready to help students learn!`);

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "⚠️  WARNING: OPENAI_API_KEY not found in environment variables!"
    );
    console.warn("   Please create a .env file with your OpenAI API key.");
  }
});
