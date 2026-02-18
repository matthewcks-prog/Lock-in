/**
 * Chat Message Builder
 *
 * Builds messages array for LLM chat completion following industry standards.
 *
 * @module services/llm/structuredMessages
 */

const { sanitizeHistory } = require('../history');
const {
  resolveSelectionContext,
  resolveUserQuestion,
  resolveBuildOptions,
  assertPromptContext,
} = require('./context');
const {
  buildContextInfo,
  buildFocusInstruction,
  buildAttachmentNote,
  buildSystemPrompt,
} = require('./promptBuilder');
const { buildAttachmentContext } = require('./attachments');
const { buildUserTextContent, buildUserMessage } = require('./userMessage');

function buildStructuredStudyMessages(options) {
  const {
    selection,
    pageContext,
    pageUrl,
    courseCode,
    language,
    chatHistory,
    newUserMessage,
    attachments,
  } = resolveBuildOptions(options);

  const selectionContext = resolveSelectionContext(selection, attachments);
  const userQuestion = resolveUserQuestion(newUserMessage);
  assertPromptContext(selectionContext);

  const systemPrompt = buildSystemPrompt({
    focusInstruction: buildFocusInstruction({
      hasUserQuestion: userQuestion.hasUserQuestion,
      hasAttachments: selectionContext.hasAttachments,
      hasSelection: selectionContext.hasSelection,
      selectionIsShort: selectionContext.selectionIsShort,
    }),
    contextInfo: buildContextInfo({ pageContext, pageUrl, courseCode }),
    attachmentNote: buildAttachmentNote(selectionContext.hasAttachments),
    selectionForPrompt: selectionContext.selectionForPrompt,
  });

  const messages = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const safeHistory = sanitizeHistory(chatHistory);
    messages.push(...safeHistory);
  }

  const attachmentContext = buildAttachmentContext(attachments);
  const userTextContent = buildUserTextContent({
    hasUserQuestion: userQuestion.hasUserQuestion,
    userQuestion: userQuestion.userQuestion,
    hasAttachments: selectionContext.hasAttachments,
    hasSelection: selectionContext.hasSelection,
    selectionIsShort: selectionContext.selectionIsShort,
    attachmentContext,
  });
  messages.push(buildUserMessage(userTextContent, attachments));

  return {
    messages,
    selectionForPrompt: selectionContext.selectionForPrompt,
    userTextContent,
    hasAttachments: selectionContext.hasAttachments,
    hasUserQuestion: userQuestion.hasUserQuestion,
    language,
  };
}

module.exports = {
  buildStructuredStudyMessages,
};
