/**
 * Unit tests for OpenAIAdapter
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { OpenAIAdapter } = require('../openaiAdapter');

describe('OpenAIAdapter', () => {
  describe('constructor', () => {
    test('should set provider name to openai', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.getProviderName(), 'openai');
    });

    test('should use default model when not specified', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.model, 'gpt-4o-mini');
    });

    test('should use custom model when specified', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'test-key', model: 'gpt-4' });
      assert.equal(adapter.model, 'gpt-4');
    });
  });

  describe('isAvailable', () => {
    test('should return true when API key is set', () => {
      const adapter = new OpenAIAdapter({ apiKey: 'test-key' });
      assert.equal(adapter.isAvailable(), true);
    });

    test('should return false when API key is missing', () => {
      const adapter = new OpenAIAdapter({});
      assert.equal(adapter.isAvailable(), false);
    });

    test('should return false when API key is null', () => {
      const adapter = new OpenAIAdapter({ apiKey: null });
      assert.equal(adapter.isAvailable(), false);
    });
  });

  describe('chatCompletion', () => {
    test('should throw error when client not initialized', async () => {
      const adapter = new OpenAIAdapter({});

      await assert.rejects(
        () => adapter.chatCompletion([{ role: 'user', content: 'Hi' }]),
        (error) => {
          assert.equal(error.provider, 'openai');
          assert.ok(error.message.includes('not initialized'));
          return true;
        },
      );
    });

    // Note: Full integration tests would require mocking the OpenAI SDK
    // which is complex due to its internal structure. For now, we test
    // the adapter's error handling and configuration.
  });
});
