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

/**
 * Create the chat edit service with injectable dependencies.
 * @param {Object} [deps] - Injected dependencies (for testing)
 * @returns {Object} - Service instance
 */
function createChatEditService(deps = {}) {
  const services = {
    chatRepository: deps.chatRepository ?? chatRepository,
  };

  /**
   * Edit a user message and truncate all subsequent messages.
   *
   * Flow:
   * 1. Validate the message belongs to the user and is a user message
   * 2. Truncate all messages after the target message
   * 3. Create a revision of the target message with new content
   * 4. Return the updated canonical timeline
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.chatId
   * @param {string} params.messageId
   * @param {string} params.newContent
   * @returns {Promise<{revision: object, canonicalMessages: object[], truncatedCount: number}>}
   */
  async function editMessageAndTruncate({ userId, chatId, messageId, newContent }) {
    if (!userId || !chatId || !messageId || !newContent) {
      throw new Error('editMessageAndTruncate requires userId, chatId, messageId, and newContent');
    }

    // Validate ownership and chat existence
    const chat = await services.chatRepository.getChatById(userId, chatId);
    if (!chat) {
      const err = new Error('Chat not found');
      err.statusCode = 404;
      throw err;
    }

    // Validate the message exists and belongs to user
    const message = await services.chatRepository.getMessageById(userId, chatId, messageId);
    if (!message) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }

    if (message.role !== 'user') {
      const err = new Error('Only user messages can be edited');
      err.statusCode = 400;
      throw err;
    }

    // 1. Truncate all messages after the target (sets is_canonical = false)
    const truncatedCount = await services.chatRepository.truncateAfterMessage({
      userId,
      chatId,
      afterMessageId: messageId,
    });

    // 2. Create revision of the target message
    const revision = await services.chatRepository.editMessage({
      userId,
      chatId,
      messageId,
      newContent,
    });

    // 3. Update chat timestamp
    await services.chatRepository.touchChat(chatId);

    // 4. Return canonical timeline
    const canonicalMessages = await services.chatRepository.getChatMessages(userId, chatId);

    return {
      revision,
      canonicalMessages,
      truncatedCount,
    };
  }

  /**
   * Truncate the last assistant message to prepare for regeneration.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.chatId
   * @returns {Promise<{canonicalMessages: object[], truncatedCount: number}>}
   */
  async function truncateForRegeneration({ userId, chatId }) {
    if (!userId || !chatId) {
      throw new Error('truncateForRegeneration requires userId and chatId');
    }

    const chat = await services.chatRepository.getChatById(userId, chatId);
    if (!chat) {
      const err = new Error('Chat not found');
      err.statusCode = 404;
      throw err;
    }

    // Get canonical messages to find the last assistant message
    const messages = await services.chatRepository.getChatMessages(userId, chatId);
    if (messages.length === 0) {
      const err = new Error('No messages to regenerate');
      err.statusCode = 400;
      throw err;
    }

    // Find the last assistant message
    let lastAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) {
      const err = new Error('No assistant message to regenerate');
      err.statusCode = 400;
      throw err;
    }

    // Find the user message just before the last assistant message
    // We truncate everything from the last assistant onward
    const lastAssistantMsg = messages[lastAssistantIndex];

    // Mark last assistant message and anything after it as non-canonical
    // We use the user message before it as the reference point
    let refMessageIndex = lastAssistantIndex - 1;
    if (refMessageIndex < 0) {
      // Edge case: assistant message is the first message (shouldn't happen normally)
      refMessageIndex = 0;
    }

    const refMessage = messages[refMessageIndex];

    const truncatedCount = await services.chatRepository.truncateAfterMessage({
      userId,
      chatId,
      afterMessageId: refMessage.id,
    });

    // Also mark the last assistant message itself if it wasn't caught by "after"
    // (it should be, since its created_at > refMessage.created_at)

    const canonicalMessages = await services.chatRepository.getChatMessages(userId, chatId);

    return {
      canonicalMessages,
      truncatedCount,
      lastUserMessage: refMessage,
    };
  }

  /**
   * Build LLM-ready chat history from canonical messages.
   *
   * @param {object[]} canonicalMessages - Messages from getCanonicalMessages
   * @returns {Array<{role: string, content: string}>}
   */
  function buildCanonicalHistory(canonicalMessages) {
    return canonicalMessages.map((msg) => ({
      role: msg.role,
      content: msg.role === 'user' ? msg.input_text || '' : msg.output_text || '',
    }));
  }

  return {
    editMessageAndTruncate,
    truncateForRegeneration,
    buildCanonicalHistory,
  };
}

const chatEditService = createChatEditService();

module.exports = {
  createChatEditService,
  chatEditService,
};
