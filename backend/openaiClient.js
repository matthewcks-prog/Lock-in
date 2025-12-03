/**
 * OpenAI Client Module - Chat based orchestration for Lock-in conversations
 */

const OpenAI = require("openai");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 30;

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const LANGUAGE_LABELS = {
  en: "English",
  es: "Spanish",
  zh: "Chinese",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
};

function toLanguageName(code = "en") {
  return LANGUAGE_LABELS[code.toLowerCase()] || code;
}

function buildModeDirective(mode, targetLanguage) {
  switch (mode) {
    case "simplify":
      return "Simplify the passage using short sentences and accessible vocabulary suitable for early university students.";
    case "translate":
      return `Translate the passage into ${toLanguageName(
        targetLanguage
      )} and include a short explanation in that language tying the translation back to the source.`;
    case "explain":
    default:
      return "Explain the passage clearly, connect the main idea to the reader's studies, and provide at most one short example when helpful.";
  }
}

function buildSystemMessage({ mode, difficultyLevel, targetLanguage }) {
  const directive = buildModeDirective(mode, targetLanguage);
  const content = [
    "You are Lock-in, an AI study helper that replies as a concise, friendly tutor.",
    `Match the student's ${difficultyLevel} level and keep answers grounded in the provided conversation and original text.`,
    directive,
    "Maintain academic integrity, cite the source text implicitly, and never introduce unrelated facts.",
  ].join(" ");

  return { role: "system", content };
}

function buildInitialHistory({
  selection,
  mode,
  difficultyLevel,
  targetLanguage,
}) {
  const systemMessage = buildSystemMessage({
    mode,
    difficultyLevel,
    targetLanguage,
  });

  const userMessage = {
    role: "user",
    content: `Original text:\n${selection}`,
  };

  return [systemMessage, userMessage];
}

function sanitizeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (message) =>
        message &&
        typeof message.role === "string" &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function clampHistory(messages) {
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return messages;
  }

  const systemMessage = messages.find((msg) => msg.role === "system");
  const withoutSystem = messages.filter((msg) => msg.role !== "system");
  const recent = withoutSystem.slice(-1 * (MAX_HISTORY_MESSAGES - 1));
  return systemMessage ? [systemMessage, ...recent] : recent;
}

async function requestCompletion(messages) {
  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 700,
  });

  const choice = completion.choices[0]?.message;
  const assistantMessage = {
    role: choice?.role || "assistant",
    content: (choice?.content || "").trim(),
  };

  return {
    assistantMessage,
    usage: completion.usage || null,
  };
}

async function generateLockInResponse(options) {
  const {
    selection,
    mode,
    difficultyLevel,
    targetLanguage,
    chatHistory = [],
    newUserMessage,
  } = options;

  const baseHistory = sanitizeHistory(chatHistory);
  let messages = baseHistory.length
    ? baseHistory
    : buildInitialHistory({ selection, mode, difficultyLevel, targetLanguage });

  if (!messages.some((msg) => msg.role === "system")) {
    messages = [
      buildSystemMessage({ mode, difficultyLevel, targetLanguage }),
      ...messages,
    ];
  }

  let workingHistory = messages;

  if (newUserMessage && newUserMessage.trim().length) {
    workingHistory = [
      ...messages,
      { role: "user", content: newUserMessage.trim() },
    ];
  }

  workingHistory = clampHistory(workingHistory);

  const { assistantMessage, usage } = await requestCompletion(workingHistory);
  const updatedHistory = [...workingHistory, assistantMessage];

  return {
    answer: assistantMessage.content,
    chatHistory: updatedHistory,
    usage,
  };
}

module.exports = {
  generateLockInResponse,
};
