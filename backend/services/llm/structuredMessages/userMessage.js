const { FOUR } = require('../../../constants/numbers');

const MAX_IMAGE_ATTACHMENTS = FOUR;

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

function buildUserMessage(userTextContent, attachments) {
  const imageAttachments = (attachments || []).filter(
    (attachment) => attachment.type === 'image' && attachment.base64,
  );
  if (imageAttachments.length === 0) {
    return { role: 'user', content: userTextContent };
  }

  const contentParts = [{ type: 'text', text: userTextContent }];
  for (const image of imageAttachments.slice(0, MAX_IMAGE_ATTACHMENTS)) {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64}`,
        detail: 'auto',
      },
    });
  }

  return { role: 'user', content: contentParts };
}

module.exports = {
  buildUserTextContent,
  buildUserMessage,
};
