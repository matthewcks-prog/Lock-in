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

function createServices(deps = {}) {
  return {
    chatRepository: deps.chatRepository ?? chatRepository,
    llmClient: deps.llmClient ?? { generateChatTitleFromHistory },
    logger: deps.logger ?? baseLogger,
  };
}

async function buildGenerationContext(services, { userId, chatId, fallbackText = '' }) {
  const messages = await services.chatRepository.getChatMessages(userId, chatId);
  const normalizedHistory = normalizeHistory(messages);
  const fallbackTitle = buildInitialChatTitle(
    extractFirstUserMessage(messages) || fallbackText || '',
  );

  return {
    messages,
    normalizedHistory,
    fallbackTitle,
  };
}

function shouldSkipAutoTitle(normalizedHistory) {
  const hasUser = normalizedHistory.some((message) => message.role === 'user');
  const hasAssistant = normalizedHistory.some((message) => message.role === 'assistant');
  return normalizedHistory.length < 2 || !hasUser || !hasAssistant;
}

async function generateChatTitleAsync(services, userId, chatId, fallbackText = '') {
  try {
    const context = await buildGenerationContext(services, { userId, chatId, fallbackText });
    if (shouldSkipAutoTitle(context.normalizedHistory)) {
      return;
    }

    const generatedTitle = await services.llmClient.generateChatTitleFromHistory({
      history: context.normalizedHistory,
      fallbackTitle: context.fallbackTitle,
    });

    await services.chatRepository.updateChatTitle(userId, chatId, generatedTitle);
  } catch (error) {
    services.logger.warn({ err: error }, 'Error in async title generation');
  }
}

async function generateChatTitle(services, { userId, chatId, fallbackText = '' } = {}) {
  const context = await buildGenerationContext(services, { userId, chatId, fallbackText });
  const generatedTitle = await services.llmClient.generateChatTitleFromHistory({
    history: context.normalizedHistory,
    fallbackTitle: context.fallbackTitle,
  });

  const stored = await services.chatRepository.updateChatTitle(userId, chatId, generatedTitle);
  return {
    title: stored?.title || generatedTitle,
    fallbackTitle: context.fallbackTitle,
  };
}

async function buildFallbackTitle(services, { userId, chatId, fallbackText = '' } = {}) {
  const messages = await services.chatRepository.getChatMessages(userId, chatId);
  return buildInitialChatTitle(extractFirstUserMessage(messages) || fallbackText || '');
}

async function persistChatTitle(services, { userId, chatId, title } = {}) {
  if (!userId || !chatId) {
    throw new Error('persistChatTitle requires userId and chatId');
  }
  return services.chatRepository.updateChatTitle(userId, chatId, title);
}

function createChatTitleService(deps = {}) {
  const services = createServices(deps);

  return {
    generateChatTitleAsync: (userId, chatId, fallbackText) =>
      generateChatTitleAsync(services, userId, chatId, fallbackText),
    generateChatTitle: (params) => generateChatTitle(services, params),
    buildFallbackTitle: (params) => buildFallbackTitle(services, params),
    persistChatTitle: (params) => persistChatTitle(services, params),
    FALLBACK_TITLE,
  };
}

const chatTitleService = createChatTitleService();

module.exports = {
  createChatTitleService,
  chatTitleService,
};
