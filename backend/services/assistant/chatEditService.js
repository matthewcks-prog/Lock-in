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

async function editMessageAndTruncate(services, params) {
  const { userId, chatId, messageId, newContent } = params;
  requireEditInputs(params);
  await ensureChatExists(services, { userId, chatId });
  await ensureEditableUserMessage(services, { userId, chatId, messageId });

  // Use atomic transaction (revision + truncation + chat update in single DB call)
  const result = await services.chatRepository.editMessage({
    userId,
    chatId,
    messageId,
    newContent,
  });

  return {
    revision: result.revision,
    canonicalMessages: result.canonicalMessages,
    truncatedCount: result.truncatedCount,
  };
}

async function truncateForRegeneration(services, params) {
  const { userId, chatId } = params;
  requireRegenerationInputs(params);
  await ensureChatExists(services, { userId, chatId });

  // Use atomic transaction (validation + truncation + chat update in single DB call)
  const result = await services.chatRepository.truncateForRegeneration({
    userId,
    chatId,
  });

  // Validate we have messages to regenerate from
  if (!result.canonicalMessages || result.canonicalMessages.length === 0) {
    throw createHttpError('No messages to regenerate', HTTP_STATUS_BAD_REQUEST);
  }

  // Find the last user message in canonical timeline for regeneration context
  const lastUserMessage = result.canonicalMessages.find(
    (msg) => msg.id === result.lastUserMessageId,
  );

  if (!lastUserMessage) {
    throw createHttpError('No user message found for regeneration', HTTP_STATUS_BAD_REQUEST);
  }

  return {
    canonicalMessages: result.canonicalMessages,
    truncatedCount: result.truncatedCount,
    lastUserMessage,
  };
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
