/**
 * Unit tests for ProviderChain
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { ProviderChain } = require('../providerChain');
const { getRateLimiterManager, resetRateLimiterManager } = require('../rateLimiter');

// Mock adapter helper
function createMockAdapter(name, options = {}) {
  return {
    getProviderName: () => name,
    isAvailable: () => options.available !== false,
    chatCompletion:
      options.chatCompletion ||
      (async () => ({
        content: `Response from ${name}`,
        provider: name,
        model: 'test-model',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })),
    healthCheck: async () => ({ available: true, provider: name }),
  };
}

describe('ProviderChain', () => {
  beforeEach(() => {
    // Reset singleton to ensure clean state
    resetRateLimiterManager();
  });

  describe('constructor', () => {
    test('should filter out unavailable adapters', () => {
      const adapters = [
        createMockAdapter('gemini', { available: true }),
        createMockAdapter('openai', { available: false }),
      ];

      const chain = new ProviderChain(adapters);
      assert.deepEqual(chain.getAvailableProviders(), ['gemini']);
    });

    test('should throw when no adapters are available', () => {
      const adapters = [
        createMockAdapter('gemini', { available: false }),
        createMockAdapter('openai', { available: false }),
      ];

      assert.throws(() => new ProviderChain(adapters), /No LLM providers available/);
    });

    test('should preserve adapter order', () => {
      const adapters = [
        createMockAdapter('gemini'),
        createMockAdapter('openai'),
        createMockAdapter('groq'),
      ];

      const chain = new ProviderChain(adapters);
      assert.deepEqual(chain.getAvailableProviders(), ['gemini', 'openai', 'groq']);
    });
  });

  describe('getPrimaryProvider', () => {
    test('should return first available provider', () => {
      const adapters = [createMockAdapter('gemini'), createMockAdapter('openai')];

      const chain = new ProviderChain(adapters);
      assert.equal(chain.getPrimaryProvider(), 'gemini');
    });
  });

  describe('chatCompletion', () => {
    test('should use primary provider when successful', async () => {
      const adapters = [createMockAdapter('gemini'), createMockAdapter('openai')];

      const chain = new ProviderChain(adapters);
      const result = await chain.chatCompletion([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.provider, 'gemini');
      assert.equal(result.content, 'Response from gemini');
      assert.equal(result.fallbackUsed, false);
    });

    test('should fallback when primary fails with rate limit', async () => {
      const primaryError = new Error('Rate limit exceeded');
      primaryError.shouldFallback = true;

      const adapters = [
        createMockAdapter('gemini', {
          chatCompletion: async () => {
            throw primaryError;
          },
        }),
        createMockAdapter('openai'),
      ];

      const chain = new ProviderChain(adapters);
      const result = await chain.chatCompletion([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.fallbackUsed, true);
      assert.deepEqual(result.attemptedProviders, ['gemini']);
    });

    test('should pass request through rate limiter', async () => {
      // Get singleton and spy on schedule
      const rateLimiter = getRateLimiterManager();
      let scheduleCalled = false;
      const originalSchedule = rateLimiter.schedule;

      rateLimiter.schedule = async (provider, fn) => {
        scheduleCalled = true;
        assert.equal(provider, 'gemini');
        return fn();
      };

      try {
        const adapters = [createMockAdapter('gemini')];
        const chain = new ProviderChain(adapters);
        await chain.chatCompletion([{ role: 'user', content: 'Hi' }]);

        assert.equal(scheduleCalled, true, 'Should have called rate limiter schedule');
      } finally {
        // Restore original method
        rateLimiter.schedule = originalSchedule;
      }
    });

    test('should NOT fallback on non-recoverable errors', async () => {
      const badRequestError = new Error('Invalid request: bad request');
      badRequestError.shouldFallback = false;

      const adapters = [
        createMockAdapter('gemini', {
          chatCompletion: async () => {
            throw badRequestError;
          },
        }),
        createMockAdapter('openai'),
      ];

      const chain = new ProviderChain(adapters);

      await assert.rejects(
        () => chain.chatCompletion([{ role: 'user', content: 'Hi' }]),
        /Invalid request/,
      );
    });

    test('should aggregate errors when all providers fail', async () => {
      const error1 = new Error('Gemini quota exceeded');
      error1.shouldFallback = true;
      const error2 = new Error('OpenAI rate limited');
      error2.shouldFallback = true;

      const adapters = [
        createMockAdapter('gemini', {
          chatCompletion: async () => {
            throw error1;
          },
        }),
        createMockAdapter('openai', {
          chatCompletion: async () => {
            throw error2;
          },
        }),
      ];

      const chain = new ProviderChain(adapters);

      await assert.rejects(
        () => chain.chatCompletion([{ role: 'user', content: 'Hi' }]),
        (error) => {
          assert.ok(error.message.includes('All LLM providers failed'));
          assert.ok(error.message.includes('Gemini quota exceeded'));
          assert.ok(error.message.includes('OpenAI rate limited'));
          assert.equal(error.errors.length, 2);
          return true;
        },
      );
    });
  });

  describe('healthCheck', () => {
    test('should check health of all providers', async () => {
      const adapters = [createMockAdapter('gemini'), createMockAdapter('openai')];

      const chain = new ProviderChain(adapters);
      const results = await chain.healthCheck();

      assert.equal(results.length, 2);
      assert.deepEqual(results[0], { available: true, provider: 'gemini' });
      assert.deepEqual(results[1], { available: true, provider: 'openai' });
    });
  });
});
