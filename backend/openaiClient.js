/**
 * OpenAI Client Module - Chat based orchestration for Lock-in conversations
 */

const OpenAI = require("openai");
const {
  buildInitialChatTitle,
  coerceGeneratedTitle,
} = require("./utils/chatTitle");

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

function buildModeDirective(mode) {
  switch (mode) {
    case "explain":
    default:
      return "Explain the passage clearly, connect the main idea to the reader's studies, and provide at most one short example when helpful.";
  }
}

function buildSystemMessage({ mode, difficultyLevel }) {
  const directive = buildModeDirective(mode);
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
}) {
  const systemMessage = buildSystemMessage({
    mode,
    difficultyLevel,
  });

  // Include the original text only if we have a selection
  // This provides context for the system message
  const userMessage = selection
    ? {
        role: "user",
        content: `Original text:\n${selection}`,
      }
    : null;

  return userMessage ? [systemMessage, userMessage] : [systemMessage];
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
    chatHistory = [],
    newUserMessage,
  } = options;

  const baseHistory = sanitizeHistory(chatHistory);
  let messages = baseHistory.length
    ? baseHistory
    : buildInitialHistory({ selection, mode, difficultyLevel });

  // Always replace or add the system message to ensure the current mode directive is used
  const systemMessage = buildSystemMessage({
    mode,
    difficultyLevel,
  });
  const messagesWithoutSystem = messages.filter((msg) => msg.role !== "system");
  messages = [systemMessage, ...messagesWithoutSystem];

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

/**
 * @typedef {Object} StudyResponse
 * @property {string} mode - The mode used ("explain" | "general")
 * @property {string} explanation - The main answer/explanation for the user
 * @property {Array<{title: string, content: string, type: string}>} notes - Array of possible notes to save
 * @property {Array<{title: string, description: string}>} todos - Array of possible tasks
 * @property {string[]} tags - Array of topic tags
 * @property {"easy" | "medium" | "hard"} difficulty - Estimated difficulty of the selected text
 */

/**
 * Generate a structured study response with explanation, notes, todos, tags, and difficulty
 * @param {Object} options - Request options
 * @param {string} options.mode - Mode: "explain" | "general"
 * @param {string} options.selection - The highlighted text (required)
 * @param {string} [options.pageContext] - Optional extra surrounding text or page summary
 * @param {string} [options.pageUrl] - Optional page URL
 * @param {string} [options.courseCode] - Optional course code (e.g. "FIT2101")
 * @param {string} [options.language] - UI language (e.g. "en")
 * @param {string} [options.difficultyLevel] - Difficulty level (e.g. "highschool", "university")
 * @param {Array<{role: string, content: string}>} [options.chatHistory] - Previous messages
 * @param {string} [options.newUserMessage] - Follow-up question from the user
 * @returns {Promise<StudyResponse>}
 */
async function generateStructuredStudyResponse(options) {
  const {
    mode = "explain",
    selection,
    pageContext,
    pageUrl,
    courseCode,
    language = "en",
    difficultyLevel = "university",
    chatHistory = [],
    newUserMessage,
  } = options;

  if (!selection || typeof selection !== "string" || selection.trim().length === 0) {
    throw new Error("Selection is required and must be a non-empty string");
  }

  // Build system prompt that adapts by mode
  let modeInstruction = "";
  switch (mode) {
    case "explain":
      modeInstruction =
        "Provide a detailed explanation in the 'explanation' field. Still create notes and todos if relevant to help the student study.";
      break;
    case "general":
      modeInstruction =
        "Treat this as general Q&A about the selection/context. Provide a helpful explanation in the 'explanation' field.";
      break;
    default:
      modeInstruction =
        "Provide a clear explanation in the 'explanation' field. Create notes and todos if relevant.";
  }

  const contextParts = [];
  if (pageContext) {
    contextParts.push(`Page context: ${pageContext}`);
  }
  if (pageUrl) {
    contextParts.push(`Page URL: ${pageUrl}`);
  }
  if (courseCode) {
    contextParts.push(`Course code: ${courseCode}`);
  }
  const contextInfo = contextParts.length > 0 ? `\n\n${contextParts.join("\n")}` : "";

  // Build difficulty instruction
  const difficultyInstruction = difficultyLevel 
    ? `Match the student's ${difficultyLevel} level in your explanation.`
    : "";

  const systemPrompt = `You are Lock-in, a helpful AI study assistant. Your task is to analyze the selected text and return a structured JSON response.

${modeInstruction}
${difficultyInstruction ? `\n${difficultyInstruction}` : ""}

Use the provided context (page context, course code, page URL) to improve the quality of tags and notes.

IMPORTANT: You MUST return ONLY a valid JSON object with this exact structure:
{
  "explanation": "string - the main answer/explanation for the user",
  "notes": [{"title": "string", "content": "string", "type": "string"}],
  "todos": [{"title": "string", "description": "string"}],
  "tags": ["string"],
  "difficulty": "easy" | "medium" | "hard"
}

Do NOT include any markdown, code blocks, or extra text. Return ONLY the JSON object.

Guidelines:
- explanation: The main answer based on the mode (explain/general)
- notes: Array of study notes that could be saved (title, content, type like "definition", "formula", "concept", etc.)
- todos: Array of study tasks (title, description)
- tags: Array of topic tags relevant to the content
- difficulty: Estimate the difficulty level of the selected text

Selected text:
${selection}${contextInfo}`;

  // Build messages array starting with system prompt
  const messages = [{ role: "system", content: systemPrompt }];

  // Append sanitized chat history if available
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const safeHistory = sanitizeHistory(chatHistory);
    messages.push(...safeHistory);
  }

  // Add final user message (either follow-up or initial request)
  let userContent;
  if (newUserMessage && newUserMessage.trim().length > 0) {
    userContent = `The student has asked a follow-up question about the selected text and the previous explanation:

"${newUserMessage.trim()}"

Using the selected text, the previous conversation, and the mode instructions, answer their question and return ONLY the structured JSON object described in the system message.`;
  } else {
    userContent = "Analyze the selected text and return the structured JSON response described in the system message.";
  }

  messages.push({ role: "user", content: userContent });

  // Clamp history before sending to OpenAI
  const finalMessages = clampHistory(messages);

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: finalMessages,
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON response: ${parseError.message}. Response: ${content.substring(0, 200)}`
      );
    }

    // Validate required fields
    if (typeof parsed.explanation !== "string") {
      throw new Error("Response missing or invalid 'explanation' field");
    }
    if (!Array.isArray(parsed.notes)) {
      parsed.notes = [];
    }
    if (!Array.isArray(parsed.todos)) {
      parsed.todos = [];
    }
    if (!Array.isArray(parsed.tags)) {
      parsed.tags = [];
    }
    if (!["easy", "medium", "hard"].includes(parsed.difficulty)) {
      parsed.difficulty = "medium";
    }

    // Validate notes structure
    parsed.notes = parsed.notes
      .filter((note) => note && typeof note.title === "string" && typeof note.content === "string")
      .map((note) => ({
        title: note.title,
        content: note.content,
        type: typeof note.type === "string" ? note.type : "general",
      }));

    // Validate todos structure
    parsed.todos = parsed.todos
      .filter(
        (todo) => todo && typeof todo.title === "string" && typeof todo.description === "string"
      )
      .map((todo) => ({
        title: todo.title,
        description: todo.description,
      }));

    // Validate tags
    parsed.tags = parsed.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0);

    // Add mode to response
    return {
      mode,
      explanation: parsed.explanation,
      notes: parsed.notes,
      todos: parsed.todos,
      tags: parsed.tags,
      difficulty: parsed.difficulty,
    };
  } catch (error) {
    if (error.message && error.message.includes("JSON")) {
      throw error;
    }
    throw new Error(`Failed to generate structured study response: ${error.message}`);
  }
}

/**
 * Generate a concise chat title (5-6 words) from the chat history.
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.history - Sanitized chat history
 * @param {string} [options.fallbackTitle] - Title to use if generation fails
 * @returns {Promise<string>}
 */
async function generateChatTitleFromHistory({ history = [], fallbackTitle = "" }) {
  const sanitizedHistory = sanitizeHistory(history)
    .map((message) => ({
      ...message,
      content: message.content.slice(0, 220),
    }))
    .slice(-12); // keep the last messages for context

  const fallback = buildInitialChatTitle(fallbackTitle);

  if (sanitizedHistory.length === 0) {
    return fallback;
  }

  const conversation = sanitizedHistory
    .map((message) => {
      const speaker = message.role === "assistant" ? "Tutor" : "Student";
      return `${speaker}: ${message.content}`;
    })
    .join("\n");

  const messages = [
    {
      role: "system",
      content:
        "You are summarizing a study conversation into a short, descriptive title. Reply with a single line of 5-6 words in sentence case. No quotes, no punctuation at the end.",
    },
    {
      role: "user",
      content: `Conversation transcript:\n${conversation}\n\nReturn only the short title.`,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 24,
    });

    const candidate = (completion.choices[0]?.message?.content || "")
      .split("\n")[0]
      .trim();

    return coerceGeneratedTitle(candidate, fallback);
  } catch (error) {
    console.error("Failed to generate chat title:", error);
    return fallback;
  }
}

/**
 * Generate embedding for text using OpenAI's embedding model
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Array of embedding floats
 */
async function embedText(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text is required and must be a non-empty string');
  }

  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
  });

  return res.data[0].embedding; // array of floats
}

/**
 * Generic chat function for use with any messages array
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @returns {Promise<string>} Assistant's response text
 */
async function chatWithModel({ messages }) {
  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 700,
  });

  const choice = completion.choices[0]?.message;
  return (choice?.content || '').trim();
}

module.exports = {
  generateLockInResponse,
  generateStructuredStudyResponse,
  generateChatTitleFromHistory,
  embedText,
  chatWithModel,
};
