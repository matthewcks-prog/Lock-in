const { randomUUID } = require('crypto');
const { createStatusError } = require('./streamingAssistantStream');

const IDEMPOTENCY_MODEL = 'cached';
const IDEMPOTENCY_PROVIDER = 'idempotency';
const HTTP_STATUS_CONFLICT = 409;

function writeCachedIdempotencyResponse(sseWriter, { cachedResponse, incomingChatId, requestId }) {
  const chatId = cachedResponse.chatId || incomingChatId || randomUUID();
  const messageId = randomUUID();

  sseWriter.writeMeta({
    chatId,
    messageId,
    requestId,
    model: IDEMPOTENCY_MODEL,
    provider: IDEMPOTENCY_PROVIDER,
  });

  const cachedContent = cachedResponse?.data?.content || '';
  if (cachedContent) {
    sseWriter.writeFinal(cachedContent, cachedResponse?.data?.usage || null);
  } else {
    sseWriter.writeError('IDEMPOTENCY_EMPTY', 'Cached response was empty', false);
  }
  sseWriter.end();
}

async function handleIdempotencyBegin(
  idempotencyStore,
  { idempotencyKey, userId, incomingChatId, requestId, sseWriter },
) {
  if (!idempotencyKey) {
    return false;
  }

  const beginResult = await idempotencyStore.begin(idempotencyKey, userId);
  if (beginResult.status === 'completed' && beginResult.response) {
    writeCachedIdempotencyResponse(sseWriter, {
      cachedResponse: beginResult.response,
      incomingChatId,
      requestId,
    });
    return true;
  }

  if (beginResult.status === 'in_progress') {
    throw createStatusError(
      'Request is already in progress. Please retry shortly.',
      HTTP_STATUS_CONFLICT,
      'IDEMPOTENCY_IN_PROGRESS',
    );
  }
  return false;
}

async function completeIdempotencyIfNeeded(
  idempotencyStore,
  { idempotencyKey, userId, responseContent, usage, chatId, chatTitle },
) {
  if (!idempotencyKey) {
    return;
  }

  await idempotencyStore.complete(idempotencyKey, userId, {
    success: true,
    data: {
      content: responseContent,
      usage,
    },
    chatId,
    chatTitle,
  });
}

module.exports = {
  handleIdempotencyBegin,
  completeIdempotencyIfNeeded,
};
