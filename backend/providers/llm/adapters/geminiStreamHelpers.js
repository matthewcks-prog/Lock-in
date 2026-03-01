const { resolveTimeoutMs } = require('../requestBudget');
const { createDeltaChunk, createStreamErrorChunk } = require('../contracts');

const SSE_EVENT_DELIMITER = '\n\n';
const SSE_DATA_PREFIX = 'data: ';
const SSE_DATA_PREFIX_LENGTH = SSE_DATA_PREFIX.length;
const ABORT_ERROR_NAME = 'AbortError';
const ABORT_ERROR_CODE = 'ABORTED';
const ABORT_ERROR_MESSAGE = 'Request was cancelled';
const UPSTREAM_ERROR_CODE = 'UPSTREAM_ERROR';
const DEFAULT_STREAM_ERROR_MESSAGE = 'Stream processing failed';

function createGeminiStreamAbortContext({ timeoutMs, fallbackTimeoutMs, signal }) {
  const controller = new AbortController();
  const resolvedTimeoutMs = resolveTimeoutMs(timeoutMs, fallbackTimeoutMs);
  const abort = () => controller.abort();
  const timeoutId = setTimeout(abort, resolvedTimeoutMs);

  if (signal) {
    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener('abort', abort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abort);
      }
    },
  };
}

async function fetchGeminiStreamResponse({ url, apiKey, requestBody, signal }) {
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
    signal,
  });
}

function toUsageMetadata(usageMetadata) {
  return {
    prompt_tokens: usageMetadata.promptTokenCount || 0,
    completion_tokens: usageMetadata.candidatesTokenCount || 0,
    total_tokens: usageMetadata.totalTokenCount || 0,
  };
}

function parseGeminiSSEPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return createDeltaChunk(text);
    }

    if (parsed.usageMetadata) {
      return {
        type: 'delta',
        content: '',
        usage: toUsageMetadata(parsed.usageMetadata),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function extractEventData(event) {
  const lines = event.split('\n');
  let data = '';

  for (const line of lines) {
    if (line.startsWith(SSE_DATA_PREFIX)) {
      data = line.slice(SSE_DATA_PREFIX_LENGTH);
    }
  }

  return data;
}

function parseGeminiSSEEvent(event) {
  const payload = extractEventData(event);
  if (!payload) {
    return null;
  }

  return parseGeminiSSEPayload(payload);
}

function splitSSEBuffer(buffer) {
  const events = buffer.split(SSE_EVENT_DELIMITER);
  const incompleteEvent = events.pop() || '';
  return { events, incompleteEvent };
}

async function readSSEBatch(reader, decoder, buffer) {
  const readResult = await reader.read();
  if (readResult.done) {
    return { done: true, buffer, events: [] };
  }

  const nextBuffer = `${buffer}${decoder.decode(readResult.value, { stream: true })}`;
  const { events, incompleteEvent } = splitSSEBuffer(nextBuffer);
  return { done: false, buffer: incompleteEvent, events };
}

function collectDeltaChunks(events, onChunk) {
  const deltaChunks = [];

  for (const event of events) {
    const chunk = parseGeminiSSEEvent(event);
    if (!chunk) {
      continue;
    }

    onChunk(chunk);
    if (chunk.type === 'delta') {
      deltaChunks.push(chunk);
    }
  }

  return deltaChunks;
}

function collectTrailingDeltaChunks(buffer, onChunk) {
  if (!buffer.trim()) {
    return [];
  }

  const trailingChunk = parseGeminiSSEEvent(buffer);
  if (!trailingChunk) {
    return [];
  }

  onChunk(trailingChunk);
  return trailingChunk.type === 'delta' ? [trailingChunk] : [];
}

async function* parseGeminiSSEStream(body, onChunk) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const batch = await readSSEBatch(reader, decoder, buffer);
      if (batch.done) {
        break;
      }

      buffer = batch.buffer;
      yield* collectDeltaChunks(batch.events, onChunk);
    }

    yield* collectTrailingDeltaChunks(buffer, onChunk);
  } finally {
    reader.releaseLock();
  }
}

function createGeminiStreamErrorChunk(error) {
  if (error?.name === ABORT_ERROR_NAME) {
    return createStreamErrorChunk(ABORT_ERROR_CODE, ABORT_ERROR_MESSAGE, false);
  }

  return createStreamErrorChunk(
    UPSTREAM_ERROR_CODE,
    error?.message || DEFAULT_STREAM_ERROR_MESSAGE,
    true,
  );
}

module.exports = {
  createGeminiStreamAbortContext,
  fetchGeminiStreamResponse,
  parseGeminiSSEStream,
  parseGeminiSSEEvent,
  createGeminiStreamErrorChunk,
};
