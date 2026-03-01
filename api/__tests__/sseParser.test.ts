import { describe, expect, it } from 'vitest';
import { parseSSEStream, type StreamEvent } from '../fetcher/sseParser';

const FULL_STREAM_EVENT_COUNT = 5;

/**
 * Helper to create a mock Response with SSE data
 */
function createSSEResponse(events: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const collectEvents = async (response: Response): Promise<StreamEvent[]> => {
  const events: StreamEvent[] = [];
  for await (const event of parseSSEStream(response)) {
    events.push(event);
  }
  return events;
};

function registerBasicEventParsingTests(): void {
  describe('basic event parsing', () => {
    it('parses a single meta event', async () => {
      const response = createSSEResponse(
        'event: meta\ndata: {"chatId":"c1","messageId":"m1","requestId":"r1"}\n\n',
      );

      const events = await collectEvents(response);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'meta',
        data: { chatId: 'c1', messageId: 'm1', requestId: 'r1' },
      });
    });

    it('parses multiple delta events', async () => {
      const response = createSSEResponse(
        'event: delta\ndata: {"content":"Hello "}\n\n' +
          'event: delta\ndata: {"content":"World"}\n\n',
      );

      const events = await collectEvents(response);

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'delta', data: { content: 'Hello ' } });
      expect(events[1]).toEqual({ type: 'delta', data: { content: 'World' } });
    });
  });
}

function registerAdditionalEventParsingTests(): void {
  describe('additional event types', () => {
    it('parses final event with usage', async () => {
      const response = createSSEResponse(
        'event: final\ndata: {"content":"Full response","usage":{"totalTokens":100}}\n\n',
      );

      const events = await collectEvents(response);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'final',
        data: { content: 'Full response', usage: { totalTokens: 100 } },
      });
    });

    it('parses error event', async () => {
      const response = createSSEResponse(
        'event: error\ndata: {"code":"RATE_LIMIT","message":"Too many requests","retryable":true}\n\n',
      );

      const events = await collectEvents(response);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        data: { code: 'RATE_LIMIT', message: 'Too many requests', retryable: true },
      });
    });
  });
}

function registerTerminalEventParsingTests(): void {
  describe('terminal events', () => {
    it('parses done event', async () => {
      const response = createSSEResponse('event: done\ndata: {}\n\n');

      const events = await collectEvents(response);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'done', data: {} });
    });

    it('parses a full streaming conversation', async () => {
      const response = createSSEResponse(
        'event: meta\ndata: {"chatId":"c1","messageId":"m1","requestId":"r1"}\n\n' +
          'event: delta\ndata: {"content":"Hello"}\n\n' +
          'event: delta\ndata: {"content":" there"}\n\n' +
          'event: final\ndata: {"content":"Hello there","usage":{"totalTokens":50}}\n\n' +
          'event: done\ndata: {}\n\n',
      );

      const events = await collectEvents(response);

      expect(events).toHaveLength(FULL_STREAM_EVENT_COUNT);
      expect(events[0]!.type).toBe('meta');
      expect(events[1]!.type).toBe('delta');
      expect(events[2]!.type).toBe('delta');
      expect(events[3]!.type).toBe('final');
      expect(events[4]!.type).toBe('done');
    });
  });
}

function registerStreamRobustnessTests(): void {
  describe('stream robustness', () => {
    it('ignores comment lines', async () => {
      const response = createSSEResponse(
        ': keep-alive\n\n' + 'event: delta\ndata: {"content":"test"}\n\n',
      );

      const events = await collectEvents(response);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('delta');
    });

    it('handles chunked data', async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'event: meta\ndata: {"cha',
        'tId":"c1","messageId":"m1","requestId":"r1"}\n\n',
        'event: delta\ndata: {"content":"Hello"}\n\n',
      ];

      const stream = new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 1));
          }
          controller.close();
        },
      });

      const response = new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });

      const events = await collectEvents(response);

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe('meta');
      expect(events[1]!.type).toBe('delta');
    });
  });
}

function registerMissingBodyTests(): void {
  describe('response validation', () => {
    it('throws on missing response body', async () => {
      const response = new Response(null);

      await expect(async () => {
        for await (const _ of parseSSEStream(response)) {
          // Should not reach here
        }
      }).rejects.toThrow('Response body is not readable');
    });
  });
}

describe('parseSSEStream', () => {
  registerBasicEventParsingTests();
  registerAdditionalEventParsingTests();
  registerTerminalEventParsingTests();
  registerStreamRobustnessTests();
  registerMissingBodyTests();
});
