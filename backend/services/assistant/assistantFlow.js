/**
 * Shared assistant flow utilities
 * Extracts common request context and title logic for both
 * streaming and non-streaming assistant services.
 */

const {
  buildInitialChatTitle,
  extractFirstUserMessage,
  FALLBACK_TITLE,
} = require('../../utils/chatTitle');

const DEFAULT_ATTACHMENT_TITLE_SEED = 'Attachment-based question';

/**
 * Build normalized request context for assistant services.
 * Pure transformation from payload to derived values.
 *
 * @param {Object} payload
 * @param {string} [attachmentTitleSeed]
 * @returns {Object}
 */
function buildRequestContext(payload = {}, attachmentTitleSeed = DEFAULT_ATTACHMENT_TITLE_SEED) {
  const {
    selection = '',
    chatHistory = [],
    newUserMessage,
    chatId: incomingChatId,
    pageContext,
    pageUrl,
    courseCode,
    language = 'en',
    attachments = [],
    regenerate = false,
  } = payload;

  const isInitialRequest = chatHistory.length === 0;
  const effectiveMode = isInitialRequest ? 'explain' : 'general';

  const trimmedSelection = typeof selection === 'string' ? selection.trim() : '';
  const trimmedUserMessage = newUserMessage ? newUserMessage.trim() : '';
  const hasAttachmentIds = Array.isArray(attachments) && attachments.length > 0;

  const userInputText =
    trimmedUserMessage || trimmedSelection || (hasAttachmentIds ? attachmentTitleSeed : '');

  const initialTitle = buildInitialChatTitle(userInputText || '');
  const firstUserMessage = extractFirstUserMessage(chatHistory);
  const initialTitleFromHistory = buildInitialChatTitle(firstUserMessage || userInputText || '');

  return {
    selection,
    chatHistory,
    newUserMessage,
    incomingChatId,
    pageContext,
    pageUrl,
    courseCode,
    language,
    attachments,
    isInitialRequest,
    effectiveMode,
    trimmedSelection,
    trimmedUserMessage,
    hasAttachmentIds,
    userInputText,
    initialTitle,
    firstUserMessage,
    initialTitleFromHistory,
    regenerate,
  };
}

/**
 * Determine if chat title should be generated
 * @param {string} existingTitle
 * @param {string} initialTitleFromHistory
 * @returns {boolean}
 */
function shouldGenerateTitle(existingTitle, initialTitleFromHistory) {
  const normalized = typeof existingTitle === 'string' ? existingTitle.trim() : '';
  return !normalized || normalized === FALLBACK_TITLE || normalized === initialTitleFromHistory;
}

module.exports = {
  buildRequestContext,
  shouldGenerateTitle,
  DEFAULT_ATTACHMENT_TITLE_SEED,
};
