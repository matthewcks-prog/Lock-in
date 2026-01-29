/**
 * OpenAI Client Module - Chat Completions Only
 *
 * Strategy:
 * - Chat Completions: OpenAI (Primary) - gpt-4o-mini (~$0.23/month)
 *
 * Note: Embeddings → services/embeddings.js (Azure primary, OpenAI fallback)
 *       Transcription → services/transcripts/transcriptionService.js (Azure Speech primary, Whisper fallback)
 *
 * @module services/llmClient
 */

const { buildInitialChatTitle, coerceGeneratedTitle } = require('../utils/chatTitle');
const { getDeployment } = require('../config');
const { createPrimaryClient, createFallbackClient } = require('../providers/llmProviderFactory');
const { withRetryAndFallback } = require('../providers/withFallback');
const MAX_HISTORY_MESSAGES = 30;
const MAX_ATTACHMENT_CONTEXT_CHARS = 5000;
const MIN_SELECTION_PRIMARY_CHARS = 20;
const ATTACHMENT_ONLY_SELECTION_PLACEHOLDER = '[Document-based question - see attached files]';

function getLlmClients() {
  const primary = createPrimaryClient();
  const fallback = createFallbackClient();
  return { primary, fallback };
}

function createChatCompletionRequest(client, provider, options) {
  const payload = {
    model: getDeployment('chat', provider),
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  };

  if (options.responseFormat) {
    payload.response_format = options.responseFormat;
  }

  return () => client.chat.completions.create(payload);
}

async function createChatCompletion(options) {
  const { primary, fallback } = getLlmClients();
  const primaryRequest = createChatCompletionRequest(primary.client, primary.provider, options);
  const fallbackRequest = fallback
    ? createChatCompletionRequest(fallback.client, fallback.provider, options)
    : null;

  return withRetryAndFallback(primaryRequest, fallbackRequest, {
    operation: options.operation || 'chat.completions.create',
    primaryProvider: primary.provider,
    fallbackProvider: fallback?.provider,
  });
}

function normalizeSelection(selection) {
  if (typeof selection !== 'string') return '';
  return selection.trim();
}

function extractHeadingLines(text, maxHeadings = 6) {
  const headings = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      headings.push(trimmed);
      if (headings.length >= maxHeadings) break;
    }
  }
  return headings;
}

function buildHeadTailSnippet(text, maxChars) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const marker = '\n\n... [content truncated] ...\n\n';
  const available = Math.max(0, maxChars - marker.length);
  const headLen = Math.max(0, Math.floor(available / 2));
  const tailLen = Math.max(0, available - headLen);
  const head = trimmed.slice(0, headLen);
  const tail = trimmed.slice(-tailLen);

  return `${head}${marker}${tail}`;
}

function buildAttachmentSnippet(text, maxChars = MAX_ATTACHMENT_CONTEXT_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const headings = extractHeadingLines(trimmed);
  const headingBlock = headings.length ? `Headings:\n${headings.join('\n')}\n\n` : '';
  const available = Math.max(0, maxChars - headingBlock.length);

  return `${headingBlock}${buildHeadTailSnippet(trimmed, available)}`;
}

function buildModeDirective(mode) {
  switch (mode) {
    case 'explain':
    default:
      return "Explain the passage clearly, connect the main idea to the reader's studies, and provide at most one short example when helpful.";
  }
}

function buildSystemMessage({ mode }) {
  const directive = buildModeDirective(mode);
  const content = [
    'You are Lock-in, an AI study helper that replies as a concise, friendly tutor.',
    'Keep answers grounded in the provided conversation and original text.',
    directive,
    'Maintain academic integrity, cite the source text implicitly, and never introduce unrelated facts.',
  ].join(' ');

  return { role: 'system', content };
}

function buildInitialHistory({ selection, mode }) {
  const systemMessage = buildSystemMessage({
    mode,
  });

  // Include the original text only if we have a selection
  // This provides context for the system message
  const userMessage = selection
    ? {
        role: 'user',
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
        typeof message.role === 'string' &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0,
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

  const systemMessage = messages.find((msg) => msg.role === 'system');
  const withoutSystem = messages.filter((msg) => msg.role !== 'system');
  const recent = withoutSystem.slice(-1 * (MAX_HISTORY_MESSAGES - 1));
  return systemMessage ? [systemMessage, ...recent] : recent;
}

function buildStructuredStudyMessages(options) {
  const {
    mode = 'explain',
    selection,
    pageContext,
    pageUrl,
    courseCode,
    language = 'en',
    chatHistory = [],
    newUserMessage,
    attachments = [],
  } = options;

  const selectionText = normalizeSelection(selection);
  const hasSelection = selectionText.length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const hasUserQuestion = typeof newUserMessage === 'string' && newUserMessage.trim().length > 0;
  const selectionIsShort =
    selectionText.length > 0 && selectionText.length < MIN_SELECTION_PRIMARY_CHARS;
  const selectionForPrompt = hasSelection
    ? selectionText
    : hasAttachments
      ? ATTACHMENT_ONLY_SELECTION_PLACEHOLDER
      : '';

  if (!hasSelection && !hasAttachments) {
    throw new Error('Selection or attachments are required to generate a response');
  }

  // Build system prompt that adapts by mode
  let modeInstruction = '';
  switch (mode) {
    case 'explain':
      modeInstruction =
        "Provide a detailed explanation in the 'explanation' field. Still create notes and todos if relevant to help the student study.";
      break;
    case 'general':
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
  const contextInfo = contextParts.length > 0 ? `\n\n${contextParts.join('\n')}` : '';

  const focusInstruction = hasUserQuestion
    ? 'Treat the student question as the primary task. Use the selected text and any attachments as supporting evidence.'
    : hasAttachments && (!hasSelection || selectionIsShort)
      ? 'The attached files/images are the primary source of context. The selected text is minimal or missing; focus on the attachments first.'
      : 'The selected text is the primary source of context. Use attachments as supporting evidence when available.';

  const attachmentNote = hasAttachments
    ? '\n\nThe student may also attach images, documents, or code files. For images, describe what you see and how it relates to the topic.'
    : '';

  const systemPrompt = `You are Lock-in, a helpful AI study assistant. Your task is to analyze the selected text and return a structured JSON response.

${modeInstruction}
${focusInstruction ? `\n${focusInstruction}` : ''}

Use the provided context (page context, course code, page URL) to improve the quality of tags and notes.${attachmentNote}

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
${selectionForPrompt}${contextInfo}`;

  // Build messages array starting with system prompt
  const messages = [{ role: 'system', content: systemPrompt }];

  // Append sanitized chat history if available
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const safeHistory = sanitizeHistory(chatHistory);
    messages.push(...safeHistory);
  }

  // Build attachment context for text-based attachments (documents, code)
  const textAttachments = (attachments || []).filter((a) => a.type !== 'image' && a.textContent);
  let attachmentContext = '';
  if (textAttachments.length > 0) {
    const attachmentTexts = textAttachments.map((a) => {
      const label = a.fileName || `${a.type} file`;
      const content = buildAttachmentSnippet(a.textContent);
      return `\n--- ${label} ---\n${content}`;
    });
    attachmentContext = `\n\nAttached files:${attachmentTexts.join('\n')}`;
  }

  // Add final user message (either follow-up or initial request)
  let userTextContent;
  if (hasUserQuestion) {
    userTextContent = `The student has asked a follow-up question about the selected text and previous explanation:

"${newUserMessage.trim()}"${attachmentContext}

Using the selected text, the previous conversation, any attached files/images, and the mode instructions, answer their question and return ONLY the structured JSON object described in the system message.`;
  } else if (hasAttachments && (!hasSelection || selectionIsShort)) {
    userTextContent = `Analyze the attached files/images as the primary source of context. The selected text is minimal or missing, so treat it as optional background. Return ONLY the structured JSON response described in the system message.${attachmentContext}`;
  } else {
    userTextContent = `Analyze the selected text${attachmentContext ? ' and the attached files/images' : ''} and return the structured JSON response described in the system message.${attachmentContext}`;
  }

  // Check if we have image attachments for vision
  const imageAttachments = (attachments || []).filter((a) => a.type === 'image' && a.base64);

  // Build user message - use multimodal format if we have images
  if (imageAttachments.length > 0) {
    // Build multimodal content array for vision
    const contentParts = [{ type: 'text', text: userTextContent }];

    // Add image parts
    for (const img of imageAttachments.slice(0, 4)) {
      // Limit to 4 images
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`,
          detail: 'auto', // Let the model decide detail level
        },
      });
    }

    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: userTextContent });
  }

  return {
    messages,
    selectionForPrompt,
    userTextContent,
    hasAttachments,
    hasUserQuestion,
    language,
  };
}

async function requestCompletion(messages) {
  const completion = await createChatCompletion({
    messages,
    temperature: 0.4,
    maxTokens: 700,
    operation: 'chat.completions.create',
  });

  const choice = completion.choices[0]?.message;
  const assistantMessage = {
    role: choice?.role || 'assistant',
    content: (choice?.content || '').trim(),
  };

  return {
    assistantMessage,
    usage: completion.usage || null,
  };
}

async function generateLockInResponse(options) {
  const { selection, mode, chatHistory = [], newUserMessage } = options;

  const baseHistory = sanitizeHistory(chatHistory);
  let messages = baseHistory.length ? baseHistory : buildInitialHistory({ selection, mode });

  // Always replace or add the system message to ensure the current mode directive is used
  const systemMessage = buildSystemMessage({
    mode,
  });
  const messagesWithoutSystem = messages.filter((msg) => msg.role !== 'system');
  messages = [systemMessage, ...messagesWithoutSystem];

  let workingHistory = messages;

  if (newUserMessage && newUserMessage.trim().length) {
    workingHistory = [...messages, { role: 'user', content: newUserMessage.trim() }];
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
 * @param {string} [options.selection] - The highlighted text (required unless attachments provided)
 * @param {string} [options.pageContext] - Optional extra surrounding text or page summary
 * @param {string} [options.pageUrl] - Optional page URL
 * @param {string} [options.courseCode] - Optional course code (e.g. "FIT2101")
 * @param {string} [options.language] - UI language (e.g. "en")
 * @param {Array<{role: string, content: string}>} [options.chatHistory] - Previous messages
 * @param {string} [options.newUserMessage] - Follow-up question from the user
 * @param {Array<Object>} [options.attachments] - Processed attachments (images with base64, documents with textContent)
 * @returns {Promise<StudyResponse>}
 */
async function generateStructuredStudyResponse(options) {
  const { mode = 'explain' } = options;
  const { messages } = buildStructuredStudyMessages(options);

  // Clamp history before sending to OpenAI
  const finalMessages = clampHistory(messages);

  try {
    const completion = await createChatCompletion({
      messages: finalMessages,
      temperature: 0.4,
      maxTokens: 1500,
      responseFormat: { type: 'json_object' },
      operation: 'chat.completions.create',
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON response: ${
          parseError.message
        }. Response: ${content.substring(0, 200)}`,
      );
    }

    // Validate required fields
    if (typeof parsed.explanation !== 'string') {
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
    if (!['easy', 'medium', 'hard'].includes(parsed.difficulty)) {
      parsed.difficulty = 'medium';
    }

    // Validate notes structure
    parsed.notes = parsed.notes
      .filter((note) => note && typeof note.title === 'string' && typeof note.content === 'string')
      .map((note) => ({
        title: note.title,
        content: note.content,
        type: typeof note.type === 'string' ? note.type : 'general',
      }));

    // Validate todos structure
    parsed.todos = parsed.todos
      .filter(
        (todo) => todo && typeof todo.title === 'string' && typeof todo.description === 'string',
      )
      .map((todo) => ({
        title: todo.title,
        description: todo.description,
      }));

    // Validate tags
    parsed.tags = parsed.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0);

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
    if (error.message && error.message.includes('JSON')) {
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
async function generateChatTitleFromHistory({ history = [], fallbackTitle = '' }) {
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
      const speaker = message.role === 'assistant' ? 'Tutor' : 'Student';
      return `${speaker}: ${message.content}`;
    })
    .join('\n');

  const messages = [
    {
      role: 'system',
      content:
        'You are summarizing a study conversation into a short, descriptive title. Reply with a single line of 5-6 words in sentence case. No quotes, no punctuation at the end.',
    },
    {
      role: 'user',
      content: `Conversation transcript:\n${conversation}\n\nReturn only the short title.`,
    },
  ];

  try {
    const completion = await createChatCompletion({
      messages,
      temperature: 0.2,
      maxTokens: 24,
      operation: 'chat.completions.create',
    });

    const candidate = (completion.choices[0]?.message?.content || '').split('\n')[0].trim();

    return coerceGeneratedTitle(candidate, fallback);
  } catch (error) {
    console.error('Failed to generate chat title:', error);
    return fallback;
  }
}

/**
 * Generic chat function for use with any messages array
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @returns {Promise<string>} Assistant's response text
 */
async function chatWithModel({ messages }) {
  const completion = await createChatCompletion({
    messages,
    temperature: 0.4,
    maxTokens: 700,
    operation: 'chat.completions.create',
  });

  const choice = completion.choices[0]?.message;
  return (choice?.content || '').trim();
}

module.exports = {
  generateLockInResponse,
  generateStructuredStudyResponse,
  buildStructuredStudyMessages,
  generateChatTitleFromHistory,
  chatWithModel,
};
