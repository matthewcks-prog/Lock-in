/**
 * Chat Edit Service
 *
 * Business logic for editing user messages and regenerating assistant responses.
 * Implements "truncate-on-edit" pattern (see ADR-002).
 *
 * Key Operations:
 * - editMessageAndTruncate: Edit a user message, truncate subsequent messages
 * - regenerateLastAssistant: Remove and regenerate the last assistant response
 * - getCanonicalHistory: Build LLM-ready history from canonical messages
 *
 * @module services/assistant/chatEditService
 */

const chatRepository = require('../../repositories/chatRepository');
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createServices(deps = {}) {
  return {
    chatRepository: deps.chatRepository ?? chatRepository,
  };
}

function requireEditInputs({ userId, chatId, messageId, newContent }) {
  if (!userId || !chatId || !messageId || !newContent) {
    throw new Error('editMessageAndTruncate requires userId, chatId, messageId, and newContent');
  }
}

function requireRegenerationInputs({ userId, chatId }) {
  if (!userId || !chatId) {
    throw new Error('truncateForRegeneration requires userId and chatId');
  }
}

async function ensureChatExists(services, { userId, chatId }) {
  const chat = await services.chatRepository.getChatById(userId, chatId);
  if (!chat) {
    throw createHttpError('Chat not found', HTTP_STATUS_NOT_FOUND);
  }
}

async function ensureEditableUserMessage(services, { userId, chatId, messageId }) {
  const message = await services.chatRepository.getMessageById(userId, chatId, messageId);
  if (!message) {
    throw createHttpError('Message not found', HTTP_STATUS_NOT_FOUND);
  }
  if (message.role !== 'user') {
    throw createHttpError('Only user messages can be edited', HTTP_STATUS_BAD_REQUEST);
  }
}

async function getCanonicalMessagesForChat(services, { userId, chatId }) {
  const messages = await services.chatRepository.getChatMessages(userId, chatId);
  if (messages.length === 0) {
    throw createHttpError('No messages to regenerate', HTTP_STATUS_BAD_REQUEST);
  }
  return messages;
}

function findLastAssistantMessageIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return index;
    }
  }
  throw createHttpError('No assistant message to regenerate', HTTP_STATUS_BAD_REQUEST);
}

function resolveReferenceMessageForRegeneration(messages, lastAssistantIndex) {
  const refMessageIndex = Math.max(0, lastAssistantIndex - 1);
  return messages[refMessageIndex];
}

async function editMessageAndTruncate(services, params) {
  const { userId, chatId, messageId, newContent } = params;
  requireEditInputs(params);
  await ensureChatExists(services, { userId, chatId });
  await ensureEditableUserMessage(services, { userId, chatId, messageId });

  const truncatedCount = await services.chatRepository.truncateAfterMessage({
    userId,
    chatId,
    afterMessageId: messageId,
  });
  const revision = await services.chatRepository.editMessage({
    userId,
    chatId,
    messageId,
    newContent,
  });

  await services.chatRepository.touchChat(chatId);
  const canonicalMessages = await services.chatRepository.getChatMessages(userId, chatId);
  return { revision, canonicalMessages, truncatedCount };
}

async function truncateForRegeneration(services, params) {
  const { userId, chatId } = params;
  requireRegenerationInputs(params);
  await ensureChatExists(services, { userId, chatId });

  const messages = await getCanonicalMessagesForChat(services, { userId, chatId });
  const lastAssistantIndex = findLastAssistantMessageIndex(messages);
  const refMessage = resolveReferenceMessageForRegeneration(messages, lastAssistantIndex);

  const truncatedCount = await services.chatRepository.truncateAfterMessage({
    userId,
    chatId,
    afterMessageId: refMessage.id,
  });
  const canonicalMessages = await services.chatRepository.getChatMessages(userId, chatId);

  return { canonicalMessages, truncatedCount, lastUserMessage: refMessage };
}

function buildCanonicalHistory(canonicalMessages) {
  return canonicalMessages.map((msg) => ({
    role: msg.role,
    content: msg.role === 'user' ? msg.input_text || '' : msg.output_text || '',
  }));
}

/**
 * Create the chat edit service with injectable dependencies.
 * @param {Object} [deps] - Injected dependencies (for testing)
 * @returns {Object} - Service instance
 */
function createChatEditService(deps = {}) {
  const services = createServices(deps);

  return {
    editMessageAndTruncate: (params) => editMessageAndTruncate(services, params),
    truncateForRegeneration: (params) => truncateForRegeneration(services, params),
    buildCanonicalHistory,
  };
}

const chatEditService = createChatEditService();

module.exports = {
  createChatEditService,
  chatEditService,
};
