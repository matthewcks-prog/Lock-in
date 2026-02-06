/**
 * Unit tests for ProviderChain
 *
 * Uses dependency injection for:
 * - sleep: Eliminates real delays
 * - rateLimiter: Isolates each test from global singleton
 *
 * Tests run in milliseconds with full isolation.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ProviderChain, immediateSleep } = require('../providerChain');
const { RateLimiterManager, TEST_LIMITS } = require('../rateLimiter');

/** @type {RateLimiterManager|null} */
let testRateLimiter = null;

/**
 * Create test options with immediate sleep and injected rate limiter
 * @returns {Object} Test options
 */
function createTestOptions() {
  return {
    sleep: immediateSleep,
    retryDelayMs: 0,
    maxRetries: 2,
    rateLimiter: testRateLimiter,
  };
}

/**
 * Create a mock adapter for testing
 * @param {string} name - Provider name
 * @param {Object} options - Mock options
 * @returns {Object} Mock adapter
 */
function createMockAdapter(name, options = {}) {
  return {
    getProviderName: () => name,
    model: options.model || 'test-model',
    isAvailable: () => options.available !== false,
    chatCompletion:
      options.chatCompletion ||
      (async () => ({
        content: `Response from ${name}`,
        provider: name,
        model: options.model || 'test-model',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })),
    healthCheck: async () => ({ available: true, provider: name }),
  };
}

describe('ProviderChain', () => {
  beforeEach(() => {
    // Create a fresh, isolated rate limiter for each test
    // No singleton dependency - complete test isolation
    testRateLimiter = new RateLimiterManager(TEST_LIMITS);
  });

  afterEach(async () => {
    // Clean up the test-specific rate limiter
    if (testRateLimiter) {
      await testRateLimiter.stop();
      testRateLimiter = null;
    }
  });

  describe('constructor', () => {
    test('should filter out unavailable adapters', () => {
      const adapters = [
        createMockAdapter('gemini', { available: true }),
        createMockAdapter('openai', { available: false }),
      ];

      const chain = new ProviderChain(adapters, createTestOptions());
      assert.deepEqual(chain.getAvailableProviders(), ['gemini']);
    });

    test('should throw when no adapters are available', () => {
      const adapters = [
        createMockAdapter('gemini', { available: false }),
        createMockAdapter('openai', { available: false }),
      ];

      assert.throws(
        () => new ProviderChain(adapters, createTestOptions()),
        /No LLM providers available/,
      );
    });

    test('should preserve adapter order', () => {
      const adapters = [
        createMockAdapter('gemini'),
        createMockAdapter('openai'),
        createMockAdapter('groq'),
      ];

      const chain = new ProviderChain(adapters, createTestOptions());
      assert.deepEqual(chain.getAvailableProviders(), ['gemini', 'openai', 'groq']);
    });
  });

  describe('getPrimaryProvider', () => {
    test('should return first available provider', () => {
      const adapters = [createMockAdapter('gemini'), createMockAdapter('openai')];

      const chain = new ProviderChain(adapters, createTestOptions());
      assert.equal(chain.getPrimaryProvider(), 'gemini');
    });
  });

  describe('chatCompletion', () => {
    test('should use primary provider when successful', async () => {
      const adapters = [createMockAdapter('gemini'), createMockAdapter('openai')];

      const chain = new ProviderChain(adapters, createTestOptions());
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

      const chain = new ProviderChain(adapters, createTestOptions());
      const result = await chain.chatCompletion([{ role: 'user', content: 'Hi' }]);

      assert.equal(result.fallbackUsed, true);
      assert.deepEqual(result.attemptedProviders, ['gemini']);
    });

    test('should pass request through rate limiter', async () => {
      // Spy on the injected rate limiter's schedule method
      let scheduleCalled = false;
      const originalSchedule = testRateLimiter.schedule.bind(testRateLimiter);

      testRateLimiter.schedule = async (provider, fn) => {
        scheduleCalled = true;
        assert.equal(provider, 'gemini');
        return originalSchedule(provider, fn);
      };

      const adapters = [createMockAdapter('gemini')];
      const chain = new ProviderChain(adapters, createTestOptions());
      await chain.chatCompletion([{ role: 'user', content: 'Hi' }]);

      assert.equal(scheduleCalled, true, 'Should have called rate limiter schedule');
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

      const chain = new ProviderChain(adapters, createTestOptions());

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

      const chain = new ProviderChain(adapters, createTestOptions());

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

      const chain = new ProviderChain(adapters, createTestOptions());
      const results = await chain.healthCheck();

      assert.equal(results.length, 2);
      assert.deepEqual(results[0], { available: true, provider: 'gemini' });
      assert.deepEqual(results[1], { available: true, provider: 'openai' });
    });
  });
});
