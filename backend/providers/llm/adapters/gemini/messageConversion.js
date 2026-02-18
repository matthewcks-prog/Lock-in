function toInlineData(url) {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mime_type: match[1],
    data: match[2],
  };
}

function convertMessageParts(content) {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part.type === 'text') {
        return { text: part.text };
      }

      if (part.type === 'image_url' && part.image_url?.url) {
        const inlineData = toInlineData(part.image_url.url);
        if (inlineData) {
          return { inline_data: inlineData };
        }
      }

      return { text: '[unsupported content]' };
    });
  }

  return [{ text: String(content) }];
}

function convertMessages(messages) {
  let systemInstruction = null;
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts = convertMessageParts(msg.content);
    contents.push({ role, parts });
  }

  return { systemInstruction, contents };
}

module.exports = {
  convertMessages,
  convertMessageParts,
  toInlineData,
};
