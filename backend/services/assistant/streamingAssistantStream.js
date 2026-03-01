const STREAM_TEMPERATURE = 0.4;
const STREAM_MAX_TOKENS = 4096;
const STREAM_OPERATION = 'chat.completions.stream';
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

function createStatusError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function createStreamState() {
  return {
    accumulatedContent: '',
    usage: null,
    actualModel: null,
    actualProvider: null,
    shouldStop: false,
  };
}

async function handleDeltaChunk({ state, chunk, sseWriter, signal, logger }) {
  state.accumulatedContent += chunk.content;

  const ok = sseWriter.writeDelta(chunk.content);
  if (!ok) {
    const drained = await sseWriter.waitForDrain();
    if (!drained || signal?.aborted) {
      logger.info('[StreamingAssistant] Stream backpressure abort');
      state.shouldStop = true;
    }
  }
}

function handleFinalChunk(state, chunk) {
  state.accumulatedContent = chunk.content || state.accumulatedContent;
  state.usage = chunk.usage || null;
  state.actualModel = chunk.model || state.actualModel;
  state.actualProvider = chunk.provider || state.actualProvider;
}

function handleMetaChunk(state, chunk) {
  state.actualModel = chunk.model || state.actualModel;
  state.actualProvider = chunk.provider || state.actualProvider;
}

function handleErrorChunk(chunk) {
  throw createStatusError(
    chunk.message || 'Stream error',
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    chunk.code || 'STREAM_ERROR',
  );
}

async function processStreamChunk({ state, chunk, sseWriter, signal, logger }) {
  if (chunk.type === 'delta') {
    await handleDeltaChunk({ state, chunk, sseWriter, signal, logger });
    return;
  }
  if (chunk.type === 'final') {
    handleFinalChunk(state, chunk);
    return;
  }
  if (chunk.type === 'meta') {
    handleMetaChunk(state, chunk);
    return;
  }
  if (chunk.type === 'error') {
    handleErrorChunk(chunk);
  }
}

function createStreamRequest(finalMessages) {
  return {
    messages: finalMessages,
    temperature: STREAM_TEMPERATURE,
    maxTokens: STREAM_MAX_TOKENS,
    operation: STREAM_OPERATION,
  };
}

async function readStreamChunks({ stream, state, signal, sseWriter, logger }) {
  for await (const chunk of stream) {
    if (signal?.aborted) {
      logger.info('[StreamingAssistant] Request aborted by client');
      break;
    }

    await processStreamChunk({
      state,
      chunk,
      sseWriter,
      signal,
      logger,
    });
    if (state.shouldStop) {
      break;
    }
  }
}

async function streamAssistantResponse(
  services,
  { finalMessages, signal, sseWriter, idempotencyKey, userId, chatId, requestId },
) {
  const state = createStreamState();

  try {
    const stream = services.chatCompletionStream(createStreamRequest(finalMessages));
    await readStreamChunks({
      stream,
      state,
      signal,
      sseWriter,
      logger: services.logger,
    });
  } catch (error) {
    services.logger.error('[StreamingAssistant] Stream error:', {
      error: error.message,
      chatId,
      requestId,
    });

    if (idempotencyKey) {
      await services.idempotencyStore.fail(idempotencyKey, userId);
    }
    throw error;
  }

  return {
    aborted: Boolean(signal?.aborted),
    responseContent: state.accumulatedContent,
    usage: state.usage,
    actualModel: state.actualModel,
    actualProvider: state.actualProvider,
  };
}

module.exports = {
  createStatusError,
  streamAssistantResponse,
};
