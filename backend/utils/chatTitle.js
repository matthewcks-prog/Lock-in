/**
 * Chat title helpers for initial fallbacks and AI-generated summaries.
 */

const DEFAULT_MAX_WORDS = 6;
const DEFAULT_MAX_LENGTH = 80;
const FALLBACK_TITLE = "New chat";

function normalizeSpaces(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function clampTitle(text = "", { maxWords = DEFAULT_MAX_WORDS, maxLength = DEFAULT_MAX_LENGTH } = {}) {
  const normalized = normalizeSpaces(text);
  if (!normalized) return "";

  const limitedWords = normalized.split(" ").slice(0, maxWords).join(" ").trim();
  if (limitedWords.length <= maxLength) return limitedWords;

  return limitedWords.slice(0, maxLength).trim();
}

function buildInitialChatTitle(text = "", options = {}) {
  const clamped = clampTitle(text, options);
  return clamped || FALLBACK_TITLE;
}

function extractFirstUserMessage(messages = []) {
  if (!Array.isArray(messages)) return null;

  for (const message of messages) {
    if (!message || (message.role && message.role !== "user")) {
      continue;
    }

    const content =
      typeof message.content === "string" && message.content.trim()
        ? message.content
        : typeof message.input_text === "string" && message.input_text.trim()
          ? message.input_text
          : typeof message.output_text === "string" && message.output_text.trim()
            ? message.output_text
            : null;

    if (content) {
      const normalized = normalizeSpaces(content);
      if (normalized) return normalized;
    }
  }

  return null;
}

function coerceGeneratedTitle(candidate = "", fallback = FALLBACK_TITLE) {
  const normalized = clampTitle(candidate);
  if (normalized) return normalized;
  return buildInitialChatTitle(fallback);
}

module.exports = {
  DEFAULT_MAX_WORDS,
  DEFAULT_MAX_LENGTH,
  FALLBACK_TITLE,
  clampTitle,
  buildInitialChatTitle,
  extractFirstUserMessage,
  coerceGeneratedTitle,
};
