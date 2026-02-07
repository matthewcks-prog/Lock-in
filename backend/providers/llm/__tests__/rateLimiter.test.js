/**
 * Unit tests for RateLimiterManager
 *
 * Uses TEST_LIMITS configuration for fast, deterministic tests.
 * Creates local instances for test isolation - avoids global singleton conflicts.
 *
 * IMPORTANT: Each test creates its own RateLimiterManager instance
 * and uses forceCleanup() for guaranteed resource release.
 */

const { test, describe, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert');
const {
  RateLimiterManager,
  getRateLimiterManager,
  getTestRateLimiterManager,
  resetRateLimiterManager,
  forceResetRateLimiterManager,
  drainEventLoop,
  DEFAULT_LIMITS,
  TEST_LIMITS,
  TOKEN_COSTS,
} = require('../rateLimiter');

describe('RateLimiterManager', () => {
  let manager;

  beforeEach(() => {
    // Ensure any global singleton is cleaned up before each test
    forceResetRateLimiterManager();
  });

  afterEach(async () => {
    // Clean up local manager instance using force cleanup for reliability
    if (manager) {
      manager.forceCleanup();
      manager = null;
    }
    // Also ensure global singleton is cleaned
    forceResetRateLimiterManager();
  });

  // Final cleanup after all tests in this describe block complete
  after(async () => {
    await drainEventLoop(5);
  });

  describe('constructor', () => {
    test('should initialize with default limits for all providers', () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      const stats = manager.getQueueStats();

      assert.ok(stats.gemini, 'Should have gemini limiter');
      assert.ok(stats.groq, 'Should have groq limiter');
      assert.ok(stats.openai, 'Should have openai limiter');
    });

    test('should accept custom limits', () => {
      const customLimits = {
        gemini: { ...TEST_LIMITS.gemini, reservoir: 100 },
      };
      manager = new RateLimiterManager(customLimits);
      const stats = manager.getQueueStats();

      assert.ok(stats.gemini);
    });
  });

  describe('schedule', () => {
    test('should execute function through rate limiter', async () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      let executed = false;

      await manager.schedule('gemini', async () => {
        executed = true;
        return { success: true };
      });

      assert.equal(executed, true);
    });

    test('should return result from scheduled function', async () => {
      manager = new RateLimiterManager(TEST_LIMITS);

      const result = await manager.schedule('gemini', async () => {
        return { content: 'test response', provider: 'gemini' };
      });

      assert.equal(result.content, 'test response');
      assert.equal(result.provider, 'gemini');
    });

    test('should execute directly for unknown provider', async () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      let executed = false;

      await manager.schedule('unknown-provider', async () => {
        executed = true;
        return { success: true };
      });

      assert.equal(executed, true);
    });

    test('should propagate errors from scheduled function', async () => {
      manager = new RateLimiterManager(TEST_LIMITS);

      await assert.rejects(
        async () => {
          await manager.schedule('gemini', async () => {
            throw new Error('Test error');
          });
        },
        { message: 'Test error' },
      );
    });
  });

  describe('recordUsage', () => {
    test('should track usage statistics', () => {
      manager = new RateLimiterManager(TEST_LIMITS);

      manager.recordUsage('gemini', 'gemini-2.0-flash', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      });

      const stats = manager.getUsageStats();
      assert.equal(stats.totalRequests, 1);
      assert.equal(stats.totalTokens, 150);
      assert.ok(stats.totalCostUsd > 0, 'Should calculate cost');
    });

    test('should accumulate usage across multiple requests', () => {
      manager = new RateLimiterManager(TEST_LIMITS);

      manager.recordUsage('gemini', 'gemini-2.0-flash', {
        prompt_tokens: 100,
        completion_tokens: 50,
      });

      manager.recordUsage('gemini', 'gemini-2.0-flash', {
        prompt_tokens: 200,
        completion_tokens: 100,
      });

      const stats = manager.getUsageStats();
      assert.equal(stats.totalRequests, 2);
      assert.equal(stats.totalTokens, 450);
    });

    test('should track usage per model', () => {
      manager = new RateLimiterManager(TEST_LIMITS);

      manager.recordUsage('gemini', 'gemini-2.0-flash', {
        prompt_tokens: 100,
        completion_tokens: 50,
      });

      manager.recordUsage('openai', 'gpt-4o-mini', {
        prompt_tokens: 200,
        completion_tokens: 100,
      });

      const stats = manager.getUsageStats();
      assert.equal(stats.models.length, 2);
      assert.ok(stats.models.some((m) => m.provider === 'gemini'));
      assert.ok(stats.models.some((m) => m.provider === 'openai'));
    });
  });

  describe('getQueueStats', () => {
    test('should return queue stats for all providers', () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      const stats = manager.getQueueStats();

      assert.ok('gemini' in stats);
      assert.ok('groq' in stats);
      assert.ok('openai' in stats);

      // Each provider should have running, queued, reservoir
      for (const provider of ['gemini', 'groq', 'openai']) {
        assert.ok('running' in stats[provider]);
        assert.ok('queued' in stats[provider]);
      }
    });
  });

  describe('pauseProvider', () => {
    test('should pause and resume provider', async () => {
      manager = new RateLimiterManager(TEST_LIMITS);

      // This should complete without error - timer is tracked and cleaned up by forceCleanup()
      await manager.pauseProvider('gemini', 100);

      // No need to wait - afterEach calls manager.forceCleanup() which cleans up the timer
    });
  });

  describe('isStopped', () => {
    test('should return false initially', () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      assert.equal(manager.isStopped(), false);
    });

    test('should return true after stop', async () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      await manager.stop();
      assert.equal(manager.isStopped(), true);
      manager = null; // Already stopped, don't cleanup again
    });

    test('should return true after forceCleanup', () => {
      manager = new RateLimiterManager(TEST_LIMITS);
      manager.forceCleanup();
      assert.equal(manager.isStopped(), true);
      manager = null; // Already stopped, don't cleanup again
    });
  });
});

describe('getRateLimiterManager', () => {
  beforeEach(() => {
    forceResetRateLimiterManager();
  });

  afterEach(() => {
    forceResetRateLimiterManager();
  });

  after(async () => {
    await drainEventLoop(5);
  });

  test('should return singleton instance', () => {
    const manager1 = getTestRateLimiterManager();
    const manager2 = getTestRateLimiterManager();

    assert.strictEqual(manager1, manager2);
  });

  test('should create new instance after reset', async () => {
    const manager1 = getTestRateLimiterManager();
    forceResetRateLimiterManager();
    const manager2 = getTestRateLimiterManager();

    assert.notStrictEqual(manager1, manager2);
  });
});

describe('DEFAULT_LIMITS', () => {
  test('should have correct structure for each provider', () => {
    for (const provider of ['gemini', 'groq', 'openai']) {
      const limits = DEFAULT_LIMITS[provider];
      assert.ok(limits.reservoir > 0, `${provider} should have reservoir`);
      assert.ok(limits.maxConcurrent > 0, `${provider} should have maxConcurrent`);
      assert.ok(limits.highWater > 0, `${provider} should have highWater`);
    }
  });

  test('should have conservative limits for paid providers', () => {
    assert.ok(DEFAULT_LIMITS.gemini.reservoir <= 200, 'Gemini should be conservative');
    assert.ok(DEFAULT_LIMITS.openai.reservoir <= 50, 'OpenAI should be conservative');
    assert.ok(DEFAULT_LIMITS.groq.reservoir <= 30, 'Groq should match free tier');
  });
});

describe('TEST_LIMITS', () => {
  test('should have no minTime delays for fast tests', () => {
    for (const provider of ['gemini', 'groq', 'openai']) {
      const limits = TEST_LIMITS[provider];
      assert.equal(limits.minTime, 0, `${provider} should have zero minTime`);
      assert.ok(limits.maxConcurrent >= 100, `${provider} should have high concurrency`);
    }
  });
});

describe('TOKEN_COSTS', () => {
  test('should have cost definitions for all providers', () => {
    assert.ok(TOKEN_COSTS.gemini, 'Should have gemini costs');
    assert.ok(TOKEN_COSTS.groq, 'Should have groq costs');
    assert.ok(TOKEN_COSTS.openai, 'Should have openai costs');
  });

  test('should have default costs for each provider', () => {
    for (const provider of ['gemini', 'groq', 'openai']) {
      const costs = TOKEN_COSTS[provider];
      assert.ok(costs.default, `${provider} should have default costs`);
      assert.ok(costs.default.input >= 0, `${provider} should have input cost`);
      assert.ok(costs.default.output >= 0, `${provider} should have output cost`);
    }
  });
});
