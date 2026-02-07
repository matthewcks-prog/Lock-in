/**
 * Unit tests for Gemini streaming functionality
 *
 * Tests the chatCompletionStream method with mocked fetch responses.
 */

const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const { GeminiAdapter } = require('../adapters/geminiAdapter');

// Helper to create a mock ReadableStream from SSE events
function createMockSSEStream(events) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        const sseEvent = `data: ${JSON.stringify(events[index])}\n\n`;
        controller.enqueue(encoder.encode(sseEvent));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Helper to create mock fetch response
function createMockResponse(events, ok = true, status = 200) {
  return {
    ok,
    status,
    body: createMockSSEStream(events),
    text: async () => JSON.stringify({ error: { message: 'Test error' } }),
  };
}

describe('GeminiAdapter Streaming', () => {
  let adapter;
  let originalFetch;

  beforeEach(() => {
    adapter = new GeminiAdapter({ apiKey: 'test-api-key' });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('supportsStreaming', () => {
    test('should return true', () => {
      assert.equal(adapter.supportsStreaming(), true);
    });
  });

  describe('chatCompletionStream', () => {
    test('yields delta chunks for each token', async () => {
      const sseEvents = [
        { candidates: [{ content: { parts: [{ text: 'Hello' }] } }] },
        { candidates: [{ content: { parts: [{ text: ' world' }] } }] },
        { candidates: [{ content: { parts: [{ text: '!' }] } }] },
      ];

      globalThis.fetch = mock.fn(async () => createMockResponse(sseEvents));

      const messages = [{ role: 'user', content: 'Say hello' }];
      const chunks = [];

      for await (const chunk of adapter.chatCompletionStream(messages)) {
        chunks.push(chunk);
      }

      // Should have 3 deltas + 1 final
      assert.equal(chunks.length, 4);
      assert.equal(chunks[0].type, 'delta');
      assert.equal(chunks[0].content, 'Hello');
      assert.equal(chunks[1].type, 'delta');
      assert.equal(chunks[1].content, ' world');
      assert.equal(chunks[2].type, 'delta');
      assert.equal(chunks[2].content, '!');
      assert.equal(chunks[3].type, 'final');
      assert.equal(chunks[3].content, 'Hello world!');
    });

    test('includes usage metadata in final chunk', async () => {
      const sseEvents = [
        { candidates: [{ content: { parts: [{ text: 'Response' }] } }] },
        {
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        },
      ];

      globalThis.fetch = mock.fn(async () => createMockResponse(sseEvents));

      const messages = [{ role: 'user', content: 'Test' }];
      const chunks = [];

      for await (const chunk of adapter.chatCompletionStream(messages)) {
        chunks.push(chunk);
      }

      const finalChunk = chunks.find((c) => c.type === 'final');
      assert.ok(finalChunk);
      assert.deepEqual(finalChunk.usage, {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });

    test('uses streaming endpoint URL', async () => {
      let calledUrl;
      globalThis.fetch = mock.fn(async (url) => {
        calledUrl = url;
        return createMockResponse([{ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] }]);
      });

      const messages = [{ role: 'user', content: 'Test' }];
      // eslint-disable-next-line no-unused-vars
      for await (const _ of adapter.chatCompletionStream(messages)) {
        // consume stream
      }

      assert.ok(calledUrl.includes(':streamGenerateContent?alt=sse'));
    });

    test('throws on non-ok response', async () => {
      globalThis.fetch = mock.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Rate limited' } }),
      }));

      const messages = [{ role: 'user', content: 'Test' }];

      await assert.rejects(
        async () => {
          // eslint-disable-next-line no-unused-vars
          for await (const _ of adapter.chatCompletionStream(messages)) {
            // Should not reach here
          }
        },
        (error) => error.message.includes('429'),
      );
    });

    test('respects abort signal', async () => {
      const controller = new AbortController();

      // Create a slow stream that we can abort
      const slowStream = new ReadableStream({
        async pull(streamController) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (!controller.signal.aborted) {
            const encoder = new TextEncoder();
            streamController.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] })}\n\n`,
              ),
            );
          }
          streamController.close();
        },
      });

      globalThis.fetch = mock.fn(async () => ({
        ok: true,
        status: 200,
        body: slowStream,
      }));

      const messages = [{ role: 'user', content: 'Test' }];

      // Abort immediately
      setTimeout(() => controller.abort(), 10);

      const chunks = [];
      try {
        for await (const chunk of adapter.chatCompletionStream(messages, {
          signal: controller.signal,
        })) {
          chunks.push(chunk);
        }
      } catch {
        // Expected to throw on abort
      }

      // Should have minimal chunks due to abort
      assert.ok(chunks.length <= 2);
    });

    test('handles empty SSE events gracefully', async () => {
      const sseEvents = [
        { candidates: [{ content: { parts: [{ text: 'Data' }] } }] },
        {}, // Empty event
        { candidates: [{ content: { parts: [{ text: '!' }] } }] },
      ];

      globalThis.fetch = mock.fn(async () => createMockResponse(sseEvents));

      const messages = [{ role: 'user', content: 'Test' }];
      const chunks = [];

      for await (const chunk of adapter.chatCompletionStream(messages)) {
        chunks.push(chunk);
      }

      // Should skip empty event, have 2 deltas + 1 final
      assert.equal(chunks.filter((c) => c.type === 'delta').length, 2);
      assert.equal(chunks.filter((c) => c.type === 'final').length, 1);
    });

    test('selects upgraded model for long input', async () => {
      let requestBody;
      globalThis.fetch = mock.fn(async (url, options) => {
        requestBody = JSON.parse(options.body);
        return createMockResponse([
          { candidates: [{ content: { parts: [{ text: 'Response' }] } }] },
        ]);
      });

      const longContent = 'a'.repeat(4000); // > 3000 chars threshold
      const messages = [{ role: 'user', content: longContent }];

      // eslint-disable-next-line no-unused-vars
      for await (const _ of adapter.chatCompletionStream(messages)) {
        // consume
      }

      // Verify the URL includes the upgraded model
      const fetchCall = globalThis.fetch.mock.calls[0];
      assert.ok(fetchCall.arguments[0].includes('gemini-2.5-flash'));
    });
  });

  describe('_parseSSEEvent', () => {
    test('extracts text from valid Gemini format', () => {
      const event = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}';
      const result = adapter._parseSSEEvent(event);

      assert.equal(result.type, 'delta');
      assert.equal(result.content, 'Hello');
    });

    test('returns null for invalid JSON', () => {
      const event = 'data: invalid json';
      const result = adapter._parseSSEEvent(event);

      assert.equal(result, null);
    });

    test('returns null for missing data prefix', () => {
      const event = '{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}';
      const result = adapter._parseSSEEvent(event);

      assert.equal(result, null);
    });

    test('extracts usage metadata when present', () => {
      const event =
        'data: {"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"totalTokenCount":15}}';
      const result = adapter._parseSSEEvent(event);

      assert.ok(result);
      assert.deepEqual(result.usage, {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });
  });
});
