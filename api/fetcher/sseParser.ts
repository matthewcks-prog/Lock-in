/**
 * SSE Stream Parser
 *
 * Parses Server-Sent Events from a ReadableStream.
 * Handles partial lines, buffering, and event parsing.
 *
 * @module api/fetcher/sseParser
 */

/**
 * SSE Event structure
 */
export type SSEEvent<T = unknown> = {
  /** Event type (meta, delta, final, error, done) */
  event: string;
  /** Parsed JSON data */
  data: T;
};

/**
 * Streaming chat event types
 */
export type StreamMetaEvent = {
  chatId: string;
  messageId: string;
  requestId: string;
  model?: string;
  provider?: string;
};

export type StreamDeltaEvent = {
  content: string;
};

export type StreamFinalEvent = {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type StreamErrorEvent = {
  code: string;
  message: string;
  retryable: boolean;
};

export type StreamDoneEvent = Record<string, never>;

export type StreamEvent =
  | { type: 'meta'; data: StreamMetaEvent }
  | { type: 'delta'; data: StreamDeltaEvent }
  | { type: 'final'; data: StreamFinalEvent }
  | { type: 'error'; data: StreamErrorEvent }
  | { type: 'done'; data: StreamDoneEvent };

/**
 * Parse a single SSE event from lines
 */
function parseSSELines(lines: string[]): SSEEvent | null {
  let eventType = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    const jsonData = dataLines.join('\n');
    const data = JSON.parse(jsonData);
    return { event: eventType, data };
  } catch {
    return null;
  }
}

function toStreamEvent(event: SSEEvent): StreamEvent {
  return {
    type: event.event as StreamEvent['type'],
    data: event.data,
  } as StreamEvent;
}

function parseEventBlock(block: string): StreamEvent | null {
  if (block.trim().length === 0) {
    return null;
  }
  const lines = block.split('\n').filter((line) => !line.startsWith(':'));
  const event = parseSSELines(lines);
  if (event === null) {
    return null;
  }
  return toStreamEvent(event);
}

function splitSSEBuffer(buffer: string): { events: StreamEvent[]; rest: string } {
  const eventBlocks = buffer.split('\n\n');
  const rest = eventBlocks.pop() ?? '';
  const events = eventBlocks
    .map(parseEventBlock)
    .filter((event): event is StreamEvent => event !== null);
  return { events, rest };
}

/**
 * Create an async generator that parses SSE events from a Response body
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = splitSSEBuffer(buffer);
      buffer = rest;
      for (const event of events) {
        yield event;
      }
    }

    // Process any remaining buffer
    const finalEvent = parseEventBlock(buffer);
    if (finalEvent !== null) {
      yield finalEvent;
    }
  } finally {
    reader.releaseLock();
  }
}
