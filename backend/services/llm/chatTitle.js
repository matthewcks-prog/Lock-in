const { logger: baseLogger } = require('../../observability');
const { buildInitialChatTitle, coerceGeneratedTitle } = require('../../utils/chatTitle');
const { createChatCompletion } = require('./providerChain');
const { sanitizeHistory } = require('./history');

const MAX_CONTEXT_MESSAGE_LENGTH = 220;
const CONTEXT_MESSAGE_COUNT = 12;
const TITLE_GENERATION_TEMPERATURE = 0.2;
const TITLE_GENERATION_MAX_TOKENS = 24;

/**
 * Generate a concise chat title (5-6 words) from the chat history.
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.history - Sanitized chat history
 * @param {string} [options.fallbackTitle] - Title to use if generation fails
 * @param {Object} [options.logger] - Optional logger override
 * @returns {Promise<string>}
 */
async function generateChatTitleFromHistory({ history = [], fallbackTitle = '', logger } = {}) {
  const log = logger ?? baseLogger;
  const sanitizedHistory = sanitizeHistory(history)
    .map((message) => ({
      ...message,
      content: message.content.slice(0, MAX_CONTEXT_MESSAGE_LENGTH),
    }))
    .slice(-CONTEXT_MESSAGE_COUNT); // keep the last messages for context

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
      temperature: TITLE_GENERATION_TEMPERATURE,
      maxTokens: TITLE_GENERATION_MAX_TOKENS,
      operation: 'chat.completions.create',
    });

    const candidate = (completion.choices[0]?.message?.content || '').split('\n')[0].trim();

    return coerceGeneratedTitle(candidate, fallback);
  } catch (error) {
    log.warn({ err: error }, 'Failed to generate chat title');
    return fallback;
  }
}

module.exports = {
  generateChatTitleFromHistory,
};
