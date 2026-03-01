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

function buildAttachmentNote(hasAttachments) {
  return hasAttachments
    ? '\n\nThe student may attach images or documents. Describe what you see in images and how it relates to the topic.'
    : '';
}

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

module.exports = {
  buildContextInfo,
  buildFocusInstruction,
  buildAttachmentNote,
  buildSystemPrompt,
};
