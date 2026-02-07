/**
 * Chat Message Builder
 *
 * Builds messages array for LLM chat completion following industry standards.
 *
 * Key Design Principles:
 * - NO forced JSON response format (LLM returns natural markdown)
 * - NO mode parameter sent to LLM (it infers intent from context)
 * - Simple system prompt defining assistant personality
 * - Context provided naturally, not as structured fields
 *
 * @module services/llm/structuredMessages
 */

const {
  MAX_ATTACHMENT_CONTEXT_CHARS,
  MIN_SELECTION_PRIMARY_CHARS,
  ATTACHMENT_ONLY_SELECTION_PLACEHOLDER,
} = require('./constants');
const { sanitizeHistory } = require('./history');

/**
 * Normalize selection text
 * @param {string|undefined} selection
 * @returns {string}
 */
function normalizeSelection(selection) {
  if (typeof selection !== 'string') return '';
  return selection.trim();
}

/**
 * Extract heading lines from text for context summary
 * @param {string} text
 * @param {number} maxHeadings
 * @returns {string[]}
 */
function extractHeadingLines(text, maxHeadings = 6) {
  const headings = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      headings.push(trimmed);
      if (headings.length >= maxHeadings) break;
    }
  }
  return headings;
}

/**
 * Build head/tail snippet for long text
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function buildHeadTailSnippet(text, maxChars) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const marker = '\n\n... [content truncated] ...\n\n';
  const available = Math.max(0, maxChars - marker.length);
  const headLen = Math.max(0, Math.floor(available / 2));
  const tailLen = Math.max(0, available - headLen);
  const head = trimmed.slice(0, headLen);
  const tail = trimmed.slice(-tailLen);

  return `${head}${marker}${tail}`;
}

/**
 * Build snippet from attachment text
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function buildAttachmentSnippet(text, maxChars = MAX_ATTACHMENT_CONTEXT_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const headings = extractHeadingLines(trimmed);
  const headingBlock = headings.length ? `Headings:\n${headings.join('\n')}\n\n` : '';
  const available = Math.max(0, maxChars - headingBlock.length);

  return `${headingBlock}${buildHeadTailSnippet(trimmed, available)}`;
}

/**
 * Resolve selection context flags
 * @param {string|undefined} selection
 * @param {Array} attachments
 * @returns {Object}
 */
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

/**
 * Resolve user question context
 * @param {string|undefined} newUserMessage
 * @returns {Object}
 */
function resolveUserQuestion(newUserMessage) {
  const trimmed = typeof newUserMessage === 'string' ? newUserMessage.trim() : '';
  return {
    hasUserQuestion: trimmed.length > 0,
    userQuestion: trimmed,
  };
}

/**
 * Build context information string
 * @param {Object} options
 * @returns {string}
 */
function buildContextInfo({ pageContext, pageUrl, courseCode }) {
  const contextParts = [];
  if (pageContext) {
    contextParts.push(`Page context: ${pageContext}`);
  }
  if (pageUrl) {
    contextParts.push(`Source: ${pageUrl}`);
  }
  if (courseCode) {
    contextParts.push(`Course: ${courseCode}`);
  }
  return contextParts.length > 0 ? `\n\n${contextParts.join('\n')}` : '';
}

/**
 * Build focus instruction based on available context
 * @param {Object} options
 * @returns {string}
 */
function buildFocusInstruction({
  hasUserQuestion,
  hasAttachments,
  hasSelection,
  selectionIsShort,
}) {
  if (hasUserQuestion) {
    return "Focus on answering the student's question. Use the selected text and any attachments as context.";
  }
  if (hasAttachments && (!hasSelection || selectionIsShort)) {
    return 'The attached files are the primary context. Analyze and explain their content.';
  }
  return 'Explain and help the student understand the selected text.';
}

/**
 * Build attachment note for system prompt
 * @param {boolean} hasAttachments
 * @returns {string}
 */
function buildAttachmentNote(hasAttachments) {
  return hasAttachments
    ? '\n\nThe student may attach images or documents. Describe what you see in images and how it relates to the topic.'
    : '';
}

/**
 * Build the system prompt - Industry standard approach
 *
 * Key principles:
 * - Define assistant personality and behavior
 * - Provide context naturally (no forced JSON structure)
 * - Let the model respond in natural language (markdown)
 * - No explicit "mode" - the model infers intent from context
 *
 * @param {Object} options
 * @returns {string}
 */
function buildSystemPrompt({ focusInstruction, contextInfo, attachmentNote, selectionForPrompt }) {
  return `You are Lock-in, a helpful AI study assistant. Your role is to help students understand their course material.

${focusInstruction}

Use markdown formatting in your responses:
- Use **bold** for key terms and important concepts
- Use bullet points for lists
- Use code blocks for technical content
- Keep explanations clear and educational
${attachmentNote}

Selected text:
${selectionForPrompt}${contextInfo}`;
}

/**
 * Build attachment context from text-based attachments
 * @param {Array} attachments
 * @returns {string}
 */
function buildAttachmentContext(attachments) {
  const textAttachments = (attachments || []).filter((a) => a.type !== 'image' && a.textContent);
  if (textAttachments.length === 0) {
    return '';
  }
  const attachmentTexts = textAttachments.map((a) => {
    const label = a.fileName || `${a.type} file`;
    const content = buildAttachmentSnippet(a.textContent);
    return `\n--- ${label} ---\n${content}`;
  });
  return `\n\nAttached files:${attachmentTexts.join('\n')}`;
}

/**
 * Build user text content based on context
 * @param {Object} options
 * @returns {string}
 */
function buildUserTextContent({
  hasUserQuestion,
  userQuestion,
  hasAttachments,
  hasSelection,
  selectionIsShort,
  attachmentContext,
}) {
  if (hasUserQuestion) {
    return `${userQuestion}${attachmentContext}`;
  }

  if (hasAttachments && (!hasSelection || selectionIsShort)) {
    return `Please analyze and explain the attached content.${attachmentContext}`;
  }

  return `Please explain this.${attachmentContext}`;
}

/**
 * Build user message with optional image attachments
 * @param {string} userTextContent
 * @param {Array} attachments
 * @returns {Object}
 */
function buildUserMessage(userTextContent, attachments) {
  const imageAttachments = (attachments || []).filter((a) => a.type === 'image' && a.base64);
  if (imageAttachments.length === 0) {
    return { role: 'user', content: userTextContent };
  }

  const contentParts = [{ type: 'text', text: userTextContent }];
  for (const img of imageAttachments.slice(0, 4)) {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'auto',
      },
    });
  }

  return { role: 'user', content: contentParts };
}

/**
 * Build messages array for chat completion
 *
 * Industry-standard approach:
 * - System message defines assistant behavior
 * - Chat history preserved for context
 * - User message contains the actual request
 * - No mode parameter - model infers intent
 *
 * @param {Object} options
 * @param {string} [options.selection] - Selected text
 * @param {string} [options.pageContext] - Page context
 * @param {string} [options.pageUrl] - Source URL
 * @param {string} [options.courseCode] - Course identifier
 * @param {string} [options.language] - Language code
 * @param {Array} [options.chatHistory] - Previous messages
 * @param {string} [options.newUserMessage] - User's follow-up question
 * @param {Array} [options.attachments] - File attachments
 * @returns {Object} - { messages, selectionForPrompt, userTextContent, hasAttachments, hasUserQuestion, language }
 */
function buildStructuredStudyMessages(options) {
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

  const selectionContext = resolveSelectionContext(selection, attachments);
  const userQuestion = resolveUserQuestion(newUserMessage);

  if (!selectionContext.hasSelection && !selectionContext.hasAttachments) {
    throw new Error('Selection or attachments are required to generate a response');
  }

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

  // Build messages array starting with system prompt
  const messages = [{ role: 'system', content: systemPrompt }];

  // Append sanitized chat history if available
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const safeHistory = sanitizeHistory(chatHistory);
    messages.push(...safeHistory);
  }

  // Build attachment context for text-based attachments (documents, code)
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
