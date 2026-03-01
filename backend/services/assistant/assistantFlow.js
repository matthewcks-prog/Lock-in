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

function normalizeTrimmedString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeAttachmentIds(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments;
}

function resolveUserInputText({
  trimmedUserMessage,
  trimmedSelection,
  hasAttachmentIds,
  attachmentTitleSeed,
}) {
  if (trimmedUserMessage) {
    return trimmedUserMessage;
  }
  if (trimmedSelection) {
    return trimmedSelection;
  }
  if (hasAttachmentIds) {
    return attachmentTitleSeed;
  }
  return '';
}

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

  const trimmedSelection = normalizeTrimmedString(selection);
  const trimmedUserMessage = normalizeTrimmedString(newUserMessage);
  const attachmentIds = normalizeAttachmentIds(attachments);
  const hasAttachmentIds = attachmentIds.length > 0;
  const userInputText = resolveUserInputText({
    trimmedUserMessage,
    trimmedSelection,
    hasAttachmentIds,
    attachmentTitleSeed,
  });

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
    attachments: attachmentIds,
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
