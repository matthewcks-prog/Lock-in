const { createChatCompletion } = require('./providerChain');
const { clampHistory } = require('./history');
const { buildStructuredStudyMessages } = require('./structuredMessages');

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

module.exports = {
  generateStructuredStudyResponse,
};
