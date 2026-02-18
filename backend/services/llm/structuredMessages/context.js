const {
  MIN_SELECTION_PRIMARY_CHARS,
  ATTACHMENT_ONLY_SELECTION_PLACEHOLDER,
} = require('../constants');

function normalizeSelection(selection) {
  if (typeof selection !== 'string') {
    return '';
  }
  return selection.trim();
}

function resolveSelectionContext(selection, attachments) {
  const selectionText = normalizeSelection(selection);
  const hasSelection = selectionText.length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const selectionIsShort =
    selectionText.length > 0 && selectionText.length < MIN_SELECTION_PRIMARY_CHARS;
  const selectionForPrompt = hasSelection
    ? selectionText
    : hasAttachments
      ? ATTACHMENT_ONLY_SELECTION_PLACEHOLDER
      : '';

  return {
    selectionText,
    hasSelection,
    hasAttachments,
    selectionIsShort,
    selectionForPrompt,
  };
}

function resolveUserQuestion(newUserMessage) {
  const trimmed = typeof newUserMessage === 'string' ? newUserMessage.trim() : '';
  return {
    hasUserQuestion: trimmed.length > 0,
    userQuestion: trimmed,
  };
}

function resolveBuildOptions(options = {}) {
  const {
    selection,
    pageContext,
    pageUrl,
    courseCode,
    language = 'en',
    chatHistory = [],
    newUserMessage,
    attachments = [],
  } = options;
  return {
    selection,
    pageContext,
    pageUrl,
    courseCode,
    language,
    chatHistory,
    newUserMessage,
    attachments,
  };
}

function assertPromptContext(selectionContext) {
  if (!selectionContext.hasSelection && !selectionContext.hasAttachments) {
    throw new Error('Selection or attachments are required to generate a response');
  }
}

module.exports = {
  normalizeSelection,
  resolveSelectionContext,
  resolveUserQuestion,
  resolveBuildOptions,
  assertPromptContext,
};
