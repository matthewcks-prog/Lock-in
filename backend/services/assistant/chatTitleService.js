const { logger: baseLogger } = require('../../observability');
const chatRepository = require('../../repositories/chatRepository');
const { generateChatTitleFromHistory } = require('../llmClient');
const {
  buildInitialChatTitle,
  extractFirstUserMessage,
  FALLBACK_TITLE,
} = require('../../utils/chatTitle');

function normalizeHistory(messages) {
  return (messages || [])
    .map((message) => {
      const content =
        (typeof message.content === 'string' && message.content.trim()) ||
        (typeof message.input_text === 'string' && message.input_text.trim()) ||
        (typeof message.output_text === 'string' && message.output_text.trim()) ||
        '';

      if (!content) return null;

      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: content.trim(),
      };
    })
    .filter(Boolean);
}

function createChatTitleService(deps = {}) {
  const services = {
    chatRepository: deps.chatRepository ?? chatRepository,
    llmClient: deps.llmClient ?? { generateChatTitleFromHistory },
    logger: deps.logger ?? baseLogger,
  };

  async function generateChatTitleAsync(userId, chatId, fallbackText = '') {
    try {
      const messages = await services.chatRepository.getChatMessages(userId, chatId);
      const normalizedHistory = normalizeHistory(messages);

      const hasUser = normalizedHistory.some((message) => message.role === 'user');
      const hasAssistant = normalizedHistory.some((message) => message.role === 'assistant');
      if (normalizedHistory.length < 2 || !hasUser || !hasAssistant) {
        return;
      }

      const fallbackTitle = buildInitialChatTitle(
        extractFirstUserMessage(messages) || fallbackText || '',
      );

      const generatedTitle = await services.llmClient.generateChatTitleFromHistory({
        history: normalizedHistory,
        fallbackTitle,
      });

      await services.chatRepository.updateChatTitle(userId, chatId, generatedTitle);
    } catch (error) {
      services.logger.warn({ err: error }, 'Error in async title generation');
    }
  }

  async function generateChatTitle({ userId, chatId, fallbackText = '' } = {}) {
    const messages = await services.chatRepository.getChatMessages(userId, chatId);
    const normalizedHistory = normalizeHistory(messages);

    const fallbackTitle = buildInitialChatTitle(
      extractFirstUserMessage(messages) || fallbackText || '',
    );

    const generatedTitle = await services.llmClient.generateChatTitleFromHistory({
      history: normalizedHistory,
      fallbackTitle,
    });

    const stored = await services.chatRepository.updateChatTitle(userId, chatId, generatedTitle);

    return {
      title: stored?.title || generatedTitle,
      fallbackTitle,
    };
  }

  async function buildFallbackTitle({ userId, chatId, fallbackText = '' } = {}) {
    const messages = await services.chatRepository.getChatMessages(userId, chatId);
    return buildInitialChatTitle(extractFirstUserMessage(messages) || fallbackText || '');
  }

  async function persistChatTitle({ userId, chatId, title } = {}) {
    if (!userId || !chatId) {
      throw new Error('persistChatTitle requires userId and chatId');
    }
    return services.chatRepository.updateChatTitle(userId, chatId, title);
  }

  return {
    generateChatTitleAsync,
    generateChatTitle,
    buildFallbackTitle,
    persistChatTitle,
    FALLBACK_TITLE,
  };
}

const chatTitleService = createChatTitleService();

module.exports = {
  createChatTitleService,
  chatTitleService,
};
