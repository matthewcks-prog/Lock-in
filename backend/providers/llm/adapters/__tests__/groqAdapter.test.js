/**
 * Unit tests for GroqAdapter
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { GroqAdapter } = require('../groqAdapter');

describe('GroqAdapter', () => {
  describe('constructor', () => {
    test('should initialize with default models', () => {
      const adapter = new GroqAdapter({ apiKey: 'test-key' });

      assert.equal(adapter.getProviderName(), 'groq');
      assert.equal(adapter.model, 'llama-3.1-8b-instant');
      assert.equal(adapter.fallbackModel, 'llama-3.3-70b-versatile');
    });

    test('should accept custom models', () => {
      const adapter = new GroqAdapter({
        apiKey: 'test-key',
        model: 'custom-model',
        fallbackModel: 'custom-fallback',
      });

      assert.equal(adapter.model, 'custom-model');
      assert.equal(adapter.fallbackModel, 'custom-fallback');
    });

    test('should be available when API key is provided', () => {
      const adapter = new GroqAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.isAvailable(), true);
    });

    test('should not be available when API key is missing', () => {
      const adapter = new GroqAdapter({});
      assert.equal(adapter.isAvailable(), false);
    });
  });

  describe('_selectModel', () => {
    let adapter;

    beforeEach(() => {
      adapter = new GroqAdapter({
        apiKey: 'test-key',
        model: 'fast-model',
        fallbackModel: 'quality-model',
      });
    });

    test('should use default model for simple queries', () => {
      const messages = [{ role: 'user', content: 'What is 2+2?' }];
      const model = adapter._selectModel(messages, {});

      assert.equal(model, 'fast-model');
    });

    test('should use fallback model when explicitly requested', () => {
      const messages = [{ role: 'user', content: 'Simple question' }];
      const model = adapter._selectModel(messages, { useHigherQualityModel: true });

      assert.equal(model, 'quality-model');
    });

    test('should auto-upgrade for step-by-step requests', () => {
      const messages = [{ role: 'user', content: 'Explain step-by-step how to solve this' }];
      const model = adapter._selectModel(messages, {});

      assert.equal(model, 'quality-model');
    });

    test('should auto-upgrade for long inputs', () => {
      const longContent = 'a'.repeat(3500);
      const messages = [{ role: 'user', content: longContent }];
      const model = adapter._selectModel(messages, {});

      assert.equal(model, 'quality-model');
    });

    test('should auto-upgrade for JSON output requests', () => {
      const messages = [{ role: 'user', content: 'Give me data' }];
      const model = adapter._selectModel(messages, { responseFormat: { type: 'json_object' } });

      assert.equal(model, 'quality-model');
    });
  });

  describe('_formatMessages', () => {
    let adapter;

    beforeEach(() => {
      adapter = new GroqAdapter({ apiKey: 'test-key' });
    });

    test('should format simple text messages', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const formatted = adapter._formatMessages(messages);

      assert.equal(formatted.length, 2);
      assert.equal(formatted[0].role, 'system');
      assert.equal(formatted[0].content, 'You are helpful');
    });

    test('should handle multimodal content', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this' },
            { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
          ],
        },
      ];

      const formatted = adapter._formatMessages(messages);

      assert.equal(formatted[0].content.length, 2);
      assert.equal(formatted[0].content[0].type, 'text');
      assert.equal(formatted[0].content[1].type, 'image_url');
    });
  });

  describe('error handling', () => {
    test('should wrap errors with provider context', () => {
      const adapter = new GroqAdapter({ apiKey: 'test-key' });
      const originalError = new Error('Something went wrong');

      const wrappedError = adapter.wrapError('chatCompletion', originalError);

      assert.ok(wrappedError.message.includes('[groq]'));
      assert.ok(wrappedError.message.includes('chatCompletion'));
      assert.equal(wrappedError.provider, 'groq');
    });
  });
});
