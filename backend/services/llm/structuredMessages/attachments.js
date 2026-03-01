const { MAX_ATTACHMENT_CONTEXT_CHARS } = require('../constants');
const { SIX } = require('../../../constants/numbers');

function extractHeadingLines(text, maxHeadings = SIX) {
  const headings = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      headings.push(trimmed);
      if (headings.length >= maxHeadings) {
        break;
      }
    }
  }
  return headings;
}

function buildHeadTailSnippet(text, maxChars) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

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
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const headings = extractHeadingLines(trimmed);
  const headingBlock = headings.length ? `Headings:\n${headings.join('\n')}\n\n` : '';
  const available = Math.max(0, maxChars - headingBlock.length);

  return `${headingBlock}${buildHeadTailSnippet(trimmed, available)}`;
}

function buildAttachmentContext(attachments) {
  const textAttachments = (attachments || []).filter((a) => a.type !== 'image' && a.textContent);
  if (textAttachments.length === 0) {
    return '';
  }

  const attachmentTexts = textAttachments.map((attachment) => {
    const label = attachment.fileName || `${attachment.type} file`;
    const content = buildAttachmentSnippet(attachment.textContent);
    return `\n--- ${label} ---\n${content}`;
  });

  return `\n\nAttached files:${attachmentTexts.join('\n')}`;
}

module.exports = {
  extractHeadingLines,
  buildHeadTailSnippet,
  buildAttachmentSnippet,
  buildAttachmentContext,
};
