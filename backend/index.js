/**
 * Lock-in Backend Server
 * Express API that handles AI-powered text processing for the Chrome extension
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { explainText, simplifyText, translateText } = require("./openaiClient");

const app = express();
const PORT = process.env.PORT || 3000;

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
  if (req.body.text) {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - Mode: ${
        req.body.mode
      }, Text length: ${req.body.text.length}`
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
    const { text, mode, targetLanguage } = req.body;

    // Validation: text is required
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Text is required and cannot be empty",
      });
    }

    // Validation: mode must be valid
    const validModes = ["explain", "simplify", "translate"];
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Mode must be one of: ${validModes.join(", ")}`,
      });
    }

    // Prevent abuse: limit text length
    if (text.length > 5000) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Text is too long. Maximum 5000 characters.",
      });
    }

    let result;

    // Process based on mode
    switch (mode) {
      case "explain":
        const explainResult = await explainText(text);
        result = {
          mode: "explain",
          answer: explainResult.answer,
          example: explainResult.example,
        };
        break;

      case "simplify":
        const simplifyResult = await simplifyText(text);
        result = {
          mode: "simplify",
          answer: simplifyResult.answer,
        };
        break;

      case "translate":
        const translateResult = await translateText(
          text,
          targetLanguage || "en"
        );
        result = {
          mode: "translate",
          answer: translateResult.answer,
          explanation: translateResult.explanation,
        };
        break;
    }

    res.json(result);
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
