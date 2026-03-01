/**
 * Unit tests for GeminiAdapter
 */

const { test, describe, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const { GeminiAdapter } = require('../geminiAdapter');

describe('GeminiAdapter', () => {
  describe('constructor', () => {
    test('should set provider name to gemini', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.getProviderName(), 'gemini');
    });

    test('should use default model when not specified', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.model, 'gemini-2.0-flash');
    });

    test('should use custom model when specified', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key', model: 'gemini-pro' });
      assert.equal(adapter.model, 'gemini-pro');
    });
  });

  describe('isAvailable', () => {
    test('should return true when API key is set', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.isAvailable(), true);
    });

    test('should return false when API key is missing', () => {
      const adapter = new GeminiAdapter({});
      assert.equal(adapter.isAvailable(), false);
    });
  });

  describe('_convertMessages', () => {
    test('should convert system message to systemInstruction', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const result = adapter._convertMessages(messages);

      assert.deepEqual(result.systemInstruction, {
        parts: [{ text: 'You are helpful' }],
      });
      assert.equal(result.contents.length, 1);
      assert.equal(result.contents[0].role, 'user');
    });

    test('should map assistant role to model', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      const messages = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];

      const result = adapter._convertMessages(messages);

      assert.equal(result.contents[1].role, 'model');
    });

    test('should convert multimodal content with images', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
            },
          ],
        },
      ];

      const result = adapter._convertMessages(messages);

      assert.equal(result.contents[0].parts.length, 2);
      assert.equal(result.contents[0].parts[0].text, 'Describe this image');
      assert.deepEqual(result.contents[0].parts[1], {
        inline_data: {
          mime_type: 'image/png',
          data: 'iVBORw0KGgo=',
        },
      });
    });
  });

  describe('chatCompletion', () => {
    let adapter;
    let originalFetch;

    beforeEach(() => {
      adapter = new GeminiAdapter({ apiKey: 'test-key' });
      originalFetch = globalThis.fetch;
    });

    test('should return properly formatted result on success', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Hello from Gemini!' }],
                  },
                },
              ],
              usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 5,
                totalTokenCount: 15,
              },
            }),
        }),
      );

      const result = await adapter.chatCompletion([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.content, 'Hello from Gemini!');
      assert.equal(result.provider, 'gemini');
      assert.equal(result.model, 'gemini-2.0-flash');
      assert.deepEqual(result.usage, {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });

      globalThis.fetch = originalFetch;
    });

    test('should throw wrapped error on API failure', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
        }),
      );

      await assert.rejects(
        () => adapter.chatCompletion([{ role: 'user', content: 'Hi' }]),
        (error) => {
          assert.equal(error.provider, 'gemini');
          assert.equal(error.operation, 'chatCompletion');
          assert.equal(error.status, 429);
          return true;
        },
      );

      globalThis.fetch = originalFetch;
    });
  });
});
