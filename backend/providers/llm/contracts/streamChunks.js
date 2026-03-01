function createDeltaChunk(content) {
  return { type: 'delta', content };
}

function createFinalChunk(content, usage = null) {
  return { type: 'final', content, ...(usage && { usage }) };
}

function createStreamErrorChunk(code, message, retryable = false) {
  return { type: 'error', code, message, retryable };
}

function createDoneChunk() {
  return { type: 'done' };
}

function createMetaChunk({ chatId, messageId, requestId, model, provider }) {
  return { type: 'meta', chatId, messageId, requestId, model, provider };
}

module.exports = {
  createDeltaChunk,
  createFinalChunk,
  createStreamErrorChunk,
  createDoneChunk,
  createMetaChunk,
};
