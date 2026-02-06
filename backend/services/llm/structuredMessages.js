const {
  MAX_ATTACHMENT_CONTEXT_CHARS,
  MIN_SELECTION_PRIMARY_CHARS,
  ATTACHMENT_ONLY_SELECTION_PLACEHOLDER,
} = require('./constants');
const { sanitizeHistory } = require('./history');

function normalizeSelection(selection) {
  if (typeof selection !== 'string') return '';
  return selection.trim();
}

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

function buildAttachmentSnippet(text, maxChars = MAX_ATTACHMENT_CONTEXT_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const headings = extractHeadingLines(trimmed);
  const headingBlock = headings.length ? `Headings:\n${headings.join('\n')}\n\n` : '';
  const available = Math.max(0, maxChars - headingBlock.length);

  return `${headingBlock}${buildHeadTailSnippet(trimmed, available)}`;
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

function buildModeInstruction(mode) {
  switch (mode) {
    case 'explain':
      return "Provide a detailed explanation in the 'explanation' field. Still create notes and todos if relevant to help the student study.";
    case 'general':
      return "Treat this as general Q&A about the selection/context. Provide a helpful explanation in the 'explanation' field.";
    default:
      return "Provide a clear explanation in the 'explanation' field. Create notes and todos if relevant.";
  }
}

function buildContextInfo({ pageContext, pageUrl, courseCode }) {
  const contextParts = [];
  if (pageContext) {
    contextParts.push(`Page context: ${pageContext}`);
  }
  if (pageUrl) {
    contextParts.push(`Page URL: ${pageUrl}`);
  }
  if (courseCode) {
    contextParts.push(`Course code: ${courseCode}`);
  }
  return contextParts.length > 0 ? `\n\n${contextParts.join('\n')}` : '';
}

function buildFocusInstruction({
  hasUserQuestion,
  hasAttachments,
  hasSelection,
  selectionIsShort,
}) {
  if (hasUserQuestion) {
    return 'Treat the student question as the primary task. Use the selected text and any attachments as supporting evidence.';
  }
  if (hasAttachments && (!hasSelection || selectionIsShort)) {
    return 'The attached files/images are the primary source of context. The selected text is minimal or missing; focus on the attachments first.';
  }
  return 'The selected text is the primary source of context. Use attachments as supporting evidence when available.';
}

function buildAttachmentNote(hasAttachments) {
  return hasAttachments
    ? '\n\nThe student may also attach images, documents, or code files. For images, describe what you see and how it relates to the topic.'
    : '';
}

function buildSystemPrompt({
  modeInstruction,
  focusInstruction,
  contextInfo,
  attachmentNote,
  selectionForPrompt,
}) {
  return `You are Lock-in, a helpful AI study assistant. Your task is to analyze the selected text and return a structured JSON response.

${modeInstruction}
${focusInstruction ? `\n${focusInstruction}` : ''}

Use the provided context (page context, course code, page URL) to improve the quality of tags and notes.${attachmentNote}

IMPORTANT: You MUST return ONLY a valid JSON object with this exact structure:
{
  "explanation": "string - the main answer/explanation for the user",
  "notes": [{"title": "string", "content": "string", "type": "string"}],
  "todos": [{"title": "string", "description": "string"}],
  "tags": ["string"],
  "difficulty": "easy" | "medium" | "hard"
}

Do NOT include any markdown, code blocks, or extra text. Return ONLY the JSON object.

Guidelines:
- explanation: The main answer based on the mode (explain/general)
- notes: Array of study notes that could be saved (title, content, type like "definition", "formula", "concept", etc.)
- todos: Array of study tasks (title, description)
- tags: Array of topic tags relevant to the content
- difficulty: Estimate the difficulty level of the selected text

Selected text:
${selectionForPrompt}${contextInfo}`;
}

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

function buildUserTextContent({
  hasUserQuestion,
  userQuestion,
  hasAttachments,
  hasSelection,
  selectionIsShort,
  attachmentContext,
}) {
  if (hasUserQuestion) {
    return `The student has asked a follow-up question about the selected text and previous explanation:

"${userQuestion}"${attachmentContext}

Using the selected text, the previous conversation, any attached files/images, and the mode instructions, answer their question and return ONLY the structured JSON object described in the system message.`;
  }

  if (hasAttachments && (!hasSelection || selectionIsShort)) {
    return `Analyze the attached files/images as the primary source of context. The selected text is minimal or missing, so treat it as optional background. Return ONLY the structured JSON response described in the system message.${attachmentContext}`;
  }

  return `Analyze the selected text${attachmentContext ? ' and the attached files/images' : ''} and return the structured JSON response described in the system message.${attachmentContext}`;
}

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

function buildStructuredStudyMessages(options) {
  const {
    mode = 'explain',
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
    modeInstruction: buildModeInstruction(mode),
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
