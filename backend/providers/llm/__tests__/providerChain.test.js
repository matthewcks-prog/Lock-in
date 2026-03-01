/**
 * Unit tests for ProviderChain
 *
 * Uses dependency injection for:
 * - sleep: Eliminates real delays
 * - rateLimiter: Isolates each test from global singleton
 *
 * Tests run in milliseconds with full isolation.
 *
 * IMPORTANT: Each test creates its own RateLimiterManager instance
 * using TEST_LIMITS (no timers) for complete isolation.
 */

const { test, describe, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert');
const { ProviderChain, immediateSleep } = require('../providerChain');
const { CircuitBreaker } = require('../circuitBreaker');
const {
  RateLimiterManager,
  TEST_LIMITS,
  drainEventLoop,
  forceResetRateLimiterManager,
} = require('../rateLimiter');

/** @type {RateLimiterManager|null} */
let testRateLimiter = null;

/**
 * Create test options with immediate sleep and injected rate limiter
 * @returns {Object} Test options
 */
function createTestOptions(overrides = {}) {
  return {
    sleep: immediateSleep,
    retryDelayMs: 0,
    maxRetries: 2,
    rateLimiter: testRateLimiter,
    ...overrides,
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
    // Ensure any global singleton is cleaned up before each test
    forceResetRateLimiterManager();
    // Create a fresh, isolated rate limiter for each test
    // No singleton dependency - complete test isolation
    testRateLimiter = new RateLimiterManager(TEST_LIMITS);
  });

  afterEach(async () => {
    // Clean up the test-specific rate limiter
    if (testRateLimiter) {
      // Use forceCleanup for synchronous cleanup when possible
      testRateLimiter.forceCleanup();
      testRateLimiter = null;
    }
    // Also ensure global singleton is cleaned
    forceResetRateLimiterManager();
  });

  // Final cleanup after all tests in this describe block complete
  // This ensures any lingering Bottleneck internals are fully drained
  after(async () => {
    await drainEventLoop(5);
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

    test('should stop when overall timeout expires', async () => {
      const slowAdapter = createMockAdapter('gemini', {
        chatCompletion: async (_messages, options = {}) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve({
                content: 'Late response',
                provider: 'gemini',
                model: 'test-model',
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
              });
            }, 80);

            if (options.signal) {
              options.signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  const error = new Error('Request aborted');
                  error.name = 'AbortError';
                  reject(error);
                },
                { once: true },
              );
            }
          }),
      });

      const chain = new ProviderChain([slowAdapter], createTestOptions());

      await assert.rejects(
        () =>
          chain.chatCompletion([{ role: 'user', content: 'Hi' }], {
            overallTimeoutMs: 20,
          }),
        (error) => {
          assert.ok(error.message.includes('deadline exceeded'));
          return true;
        },
      );
    });

    test('should pass per-attempt timeout to adapter', async () => {
      let observedTimeout = null;
      const adapter = createMockAdapter('gemini', {
        chatCompletion: async (_messages, options = {}) => {
          observedTimeout = options.timeoutMs;
          return {
            content: 'ok',
            provider: 'gemini',
            model: 'test-model',
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          };
        },
      });

      const chain = new ProviderChain([adapter], createTestOptions());
      await chain.chatCompletion([{ role: 'user', content: 'Hi' }], {
        overallTimeoutMs: 1000,
        timeoutMs: 50,
      });

      assert.equal(observedTimeout, 50);
    });

    test('should skip provider when circuit is open', async () => {
      let primaryCalls = 0;
      const primary = createMockAdapter('gemini', {
        chatCompletion: async () => {
          primaryCalls += 1;
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        },
      });
      const fallback = createMockAdapter('openai');
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        openDurationMs: 60000,
        now: () => Date.now(),
      });

      const chain = new ProviderChain(
        [primary, fallback],
        createTestOptions({ circuitBreaker: breaker, maxRetries: 1 }),
      );
      const first = await chain.chatCompletion([{ role: 'user', content: 'Hi' }]);
      assert.equal(first.provider, 'openai');
      assert.equal(primaryCalls, 1);

      const second = await chain.chatCompletion([{ role: 'user', content: 'Hi again' }]);
      assert.equal(second.provider, 'openai');
      assert.equal(primaryCalls, 1, 'Primary should be skipped while circuit is open');
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

  describe('chatCompletionStream', () => {
    /**
     * Create a mock adapter with streaming support
     */
    function createStreamingMockAdapter(name, options = {}) {
      return {
        getProviderName: () => name,
        model: options.model || 'test-model',
        isAvailable: () => options.available !== false,
        supportsStreaming: () => true,
        chatCompletion:
          options.chatCompletion ||
          (async () => ({
            content: `Response from ${name}`,
            provider: name,
            model: options.model || 'test-model',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          })),
        chatCompletionStream:
          options.chatCompletionStream ||
          async function* () {
            yield { type: 'delta', content: 'Hello' };
            yield { type: 'delta', content: ' world' };
            yield {
              type: 'final',
              content: 'Hello world',
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };
          },
        healthCheck: async () => ({ available: true, provider: name }),
      };
    }

    test('should stream from primary provider', async () => {
      const adapters = [createStreamingMockAdapter('gemini')];
      const chain = new ProviderChain(adapters, createTestOptions());

      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 3);
      assert.equal(chunks[0].type, 'delta');
      assert.equal(chunks[0].content, 'Hello');
      assert.equal(chunks[1].type, 'delta');
      assert.equal(chunks[1].content, ' world');
      assert.equal(chunks[2].type, 'final');
      assert.equal(chunks[2].content, 'Hello world');
    });

    test('should fallback before streaming starts', async () => {
      const failingAdapter = createStreamingMockAdapter('gemini', {
        available: false,
      });
      const fallbackAdapter = createStreamingMockAdapter('openai');

      const chain = new ProviderChain([failingAdapter, fallbackAdapter], createTestOptions());

      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      // Should have received chunks from fallback
      assert.ok(chunks.length > 0);
      assert.equal(chunks[0].type, 'delta');
    });

    test('should yield error chunk when all providers unavailable', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        openDurationMs: 60000,
      });
      // Pre-open the circuit
      await breaker.recordFailure('gemini');

      const adapters = [createStreamingMockAdapter('gemini')];
      const chain = new ProviderChain(adapters, createTestOptions({ circuitBreaker: breaker }));

      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
      assert.equal(chunks[0].type, 'error');
      assert.equal(chunks[0].code, 'SERVICE_UNAVAILABLE');
    });

    test('should yield error chunk when stream fails mid-way', async () => {
      const failingStreamAdapter = createStreamingMockAdapter('gemini', {
        chatCompletionStream: async function* () {
          yield { type: 'delta', content: 'Starting...' };
          throw new Error('Connection lost');
        },
      });

      const chain = new ProviderChain([failingStreamAdapter], createTestOptions());

      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      // Should have delta then error
      assert.equal(chunks.length, 2);
      assert.equal(chunks[0].type, 'delta');
      assert.equal(chunks[1].type, 'error');
      assert.equal(chunks[1].code, 'UPSTREAM_ERROR');
    });

    test('should record success in circuit breaker after stream completes', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        openDurationMs: 60000,
      });

      // Record some failures first
      await breaker.recordFailure('gemini');
      await breaker.recordFailure('gemini');

      const adapters = [createStreamingMockAdapter('gemini')];
      const chain = new ProviderChain(adapters, createTestOptions({ circuitBreaker: breaker }));

      // Stream should complete and record success
      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      // Should complete without hitting circuit breaker
      assert.ok(chunks.some((c) => c.type === 'final'));
    });

    test('should record failure in circuit breaker when stream errors', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        openDurationMs: 60000,
      });
      await breaker.recordFailure('gemini');

      const failingStreamAdapter = createStreamingMockAdapter('gemini', {
        chatCompletionStream: async function* () {
          throw new Error('Provider error');
        },
      });

      const chain = new ProviderChain(
        [failingStreamAdapter],
        createTestOptions({ circuitBreaker: breaker }),
      );

      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      // Circuit should now be open
      const canRequest = await breaker.canRequest('gemini');
      assert.equal(canRequest.allowed, false);
    });

    test('should pass usage to rate limiter on final chunk', async () => {
      let recordedUsage = null;
      const mockRateLimiter = {
        schedule: async (_provider, fn, _opts) => fn(),
        recordUsage: (_provider, _model, usage) => {
          recordedUsage = usage;
        },
      };

      const adapters = [createStreamingMockAdapter('gemini')];
      const chain = new ProviderChain(
        adapters,
        createTestOptions({ rateLimiter: mockRateLimiter }),
      );

      const chunks = [];
      for await (const chunk of chain.chatCompletionStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      assert.ok(recordedUsage);
      assert.equal(recordedUsage.prompt_tokens, 10);
      assert.equal(recordedUsage.completion_tokens, 5);
    });
  });
});
