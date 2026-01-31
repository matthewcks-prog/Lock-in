/**
 * Rate Limiter Module
 *
 * Token-bucket rate limiting for LLM providers using bottleneck.
 * Provides per-provider rate limits, queue smoothing, and usage tracking.
 *
 * Features:
 * - Per-provider rate limits with reservoir auto-refill
 * - Concurrency limits to prevent overwhelming APIs
 * - Queue overflow protection (rejects when queue is full)
 * - Usage tracking (requests, tokens, cost estimates)
 * - Retry-After header integration
 *
 * @module providers/llm/rateLimiter
 */

const Bottleneck = require('bottleneck');
const { logger } = require('../../observability');

/**
 * Per-provider rate limit configurations
 * Conservative limits for reliability
 */
const DEFAULT_LIMITS = {
  gemini: {
    reservoir: 200, // Requests per minute (paid tier, conservative)
    reservoirRefreshAmount: 200,
    reservoirRefreshInterval: 60000, // 60 seconds
    maxConcurrent: 10, // Max concurrent requests
    minTime: 50, // Minimum 50ms between requests
    highWater: 30, // Max queued jobs before rejecting
    strategy: Bottleneck.strategy.OVERFLOW,
  },
  groq: {
    reservoir: 30, // Free tier: 30 RPM
    reservoirRefreshAmount: 30,
    reservoirRefreshInterval: 60000,
    maxConcurrent: 3,
    minTime: 200,
    highWater: 10,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
  openai: {
    reservoir: 50, // Conservative (last resort fallback)
    reservoirRefreshAmount: 50,
    reservoirRefreshInterval: 60000,
    maxConcurrent: 5,
    minTime: 150,
    highWater: 15,
    strategy: Bottleneck.strategy.OVERFLOW,
  },
};

/**
 * Approximate per-token costs (USD) for cost estimation
 * Updated: 2026-01
 */
const TOKEN_COSTS = {
  gemini: {
    'gemini-2.0-flash': { input: 0.0000001, output: 0.0000004 },
    'gemini-2.5-flash': { input: 0.00000015, output: 0.0000006 },
    'gemini-2.5-pro': { input: 0.00000125, output: 0.000005 },
    default: { input: 0.0000001, output: 0.0000004 },
  },
  groq: {
    'llama-3.3-70b-versatile': { input: 0.00000059, output: 0.00000079 },
    'llama-3.1-8b-instant': { input: 0.00000005, output: 0.00000008 },
    default: { input: 0.00000059, output: 0.00000079 },
  },
  openai: {
    'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
    'gpt-4o': { input: 0.0000025, output: 0.00001 },
    default: { input: 0.00000015, output: 0.0000006 },
  },
};

/**
 * Usage statistics tracker
 */
class UsageTracker {
  constructor() {
    this.stats = new Map(); // Map<provider:model, { requests, inputTokens, outputTokens, estimatedCost }>
    this.startTime = Date.now();
  }

  /**
   * Record usage for a request
   * @param {string} provider - Provider name
   * @param {string} model - Model name
   * @param {Object} usage - Token usage from response
   */
  record(provider, model, usage) {
    const key = `${provider}:${model}`;
    const current = this.stats.get(key) || {
      provider,
      model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };

    current.requests++;

    if (usage) {
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;

      current.inputTokens += inputTokens;
      current.outputTokens += outputTokens;

      // Calculate cost estimate
      const costs = TOKEN_COSTS[provider]?.[model] ||
        TOKEN_COSTS[provider]?.default || { input: 0, output: 0 };
      current.estimatedCost += inputTokens * costs.input + outputTokens * costs.output;
    }

    this.stats.set(key, current);
  }

  /**
   * Get all usage statistics
   * @returns {Object}
   */
  getStats() {
    const models = Array.from(this.stats.values());
    const totalRequests = models.reduce((sum, m) => sum + m.requests, 0);
    const totalTokens = models.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const totalCost = models.reduce((sum, m) => sum + m.estimatedCost, 0);

    return {
      uptimeMs: Date.now() - this.startTime,
      totalRequests,
      totalTokens,
      totalCostUsd: Math.round(totalCost * 1000000) / 1000000, // Round to 6 decimals
      models: models.map((m) => ({
        ...m,
        estimatedCost: Math.round(m.estimatedCost * 1000000) / 1000000,
      })),
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.stats.clear();
    this.startTime = Date.now();
  }
}

/**
 * Rate Limiter Manager
 *
 * Manages per-provider bottleneck instances and usage tracking.
 */
class RateLimiterManager {
  constructor(customLimits = {}) {
    this.limiters = new Map();
    this.limits = { ...DEFAULT_LIMITS, ...customLimits };
    this.usageTracker = new UsageTracker();
    this._loggingInterval = null;
    this._pauseTimers = new Map(); // Track pause timers for cleanup

    // Initialize limiters for each provider
    for (const [provider, config] of Object.entries(this.limits)) {
      this.limiters.set(provider, this._createLimiter(provider, config));
    }

    // Start periodic usage logging (every 5 minutes)
    this._startUsageLogging();

    logger.info('RateLimiterManager initialized', {
      providers: Object.keys(this.limits),
    });
  }

  /**
   * Create a bottleneck limiter with event handlers
   * @private
   */
  _createLimiter(provider, config) {
    const limiter = new Bottleneck(config);

    // Log when requests are queued
    limiter.on('queued', () => {
      const counts = limiter.counts();
      if (counts.QUEUED > 5) {
        logger.warn(`Rate limiter queue growing for ${provider}`, {
          provider,
          queued: counts.QUEUED,
          running: counts.RUNNING,
        });
      }
    });

    // Log when requests are dropped (queue overflow)
    limiter.on('dropped', (dropped) => {
      logger.error(`Rate limiter dropped request for ${provider}`, {
        provider,
        dropped: dropped?.options?.id || 'unknown',
      });
    });

    // Handle errors to prevent unhandled events
    limiter.on('error', (error) => {
      logger.error(`Rate limiter error for ${provider}`, {
        provider,
        error: error.message,
      });
    });

    return limiter;
  }

  /**
   * Start periodic usage logging
   * @private
   */
  _startUsageLogging() {
    const FIVE_MINUTES = 5 * 60 * 1000;
    this._loggingInterval = setInterval(() => {
      const stats = this.usageTracker.getStats();
      if (stats.totalRequests > 0) {
        logger.info('LLM usage stats', {
          uptimeMinutes: Math.round(stats.uptimeMs / 60000),
          totalRequests: stats.totalRequests,
          totalTokens: stats.totalTokens,
          totalCostUsd: stats.totalCostUsd,
          models: stats.models,
        });
      }
    }, FIVE_MINUTES);

    // Don't prevent process exit
    if (this._loggingInterval.unref) {
      this._loggingInterval.unref();
    }
  }

  /**
   * Schedule a request through the rate limiter
   * @param {string} provider - Provider name
   * @param {Function} fn - Async function to execute
   * @param {Object} [options] - Options
   * @param {number} [options.priority=5] - Job priority (0-9, lower = higher priority)
   * @param {number} [options.timeout=30000] - Max time to wait in queue (ms)
   * @returns {Promise<any>} - Result from fn
   */
  async schedule(provider, fn, options = {}) {
    const limiter = this.limiters.get(provider);

    if (!limiter) {
      // No limiter for this provider - execute directly
      logger.warn(`No rate limiter configured for ${provider}, executing directly`);
      return fn();
    }

    const priority = options.priority ?? 5;
    const timeout = options.timeout ?? 30000;

    try {
      // Check if queue is already at capacity
      const counts = limiter.counts();
      const config = this.limits[provider];

      if (counts.QUEUED >= config.highWater) {
        const error = new Error(
          `Rate limit queue full for ${provider}. Try again in a few seconds.`,
        );
        error.status = 429;
        error.retryAfter = 5;
        error.shouldFallback = true;
        throw error;
      }

      // Schedule through bottleneck
      return await limiter.schedule(
        {
          priority,
          expiration: timeout,
          id: `${provider}-${Date.now()}`,
        },
        fn,
      );
    } catch (error) {
      // Handle bottleneck-specific errors
      if (error.message?.includes('This job has been dropped')) {
        const queueError = new Error(
          `Rate limit queue full for ${provider}. Try again in a few seconds.`,
        );
        queueError.status = 429;
        queueError.retryAfter = 5;
        queueError.shouldFallback = true;
        throw queueError;
      }

      if (error.message?.includes('This job timed out')) {
        const timeoutError = new Error(`Request queued too long for ${provider}. Try again later.`);
        timeoutError.status = 429;
        timeoutError.retryAfter = 10;
        timeoutError.shouldFallback = true;
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * Record usage after successful request
   * @param {string} provider - Provider name
   * @param {string} model - Model name
   * @param {Object} usage - Token usage
   */
  recordUsage(provider, model, usage) {
    this.usageTracker.record(provider, model, usage);
  }

  /**
   * Get current queue statistics for all providers
   * @returns {Object}
   */
  getQueueStats() {
    const stats = {};
    for (const [provider, limiter] of this.limiters) {
      const counts = limiter.counts();
      stats[provider] = {
        running: counts.RUNNING,
        queued: counts.QUEUED,
        reservoir: counts.RESERVOIR ?? 'unlimited',
      };
    }
    return stats;
  }

  /**
   * Get usage statistics
   * @returns {Object}
   */
  getUsageStats() {
    return this.usageTracker.getStats();
  }

  /**
   * Pause requests for a provider (e.g., when receiving Retry-After)
   * @param {string} provider - Provider name
   * @param {number} durationMs - Duration to pause (ms)
   */
  async pauseProvider(provider, durationMs) {
    const limiter = this.limiters.get(provider);
    if (!limiter) return;

    logger.info(`Pausing ${provider} for ${durationMs}ms due to rate limit`, {
      provider,
      durationMs,
    });

    // Temporarily set reservoir to 0
    await limiter.updateSettings({ reservoir: 0 });

    // Clear any existing pause timer for this provider
    if (this._pauseTimers.has(provider)) {
      clearTimeout(this._pauseTimers.get(provider));
    }

    // Restore after duration (track timer for cleanup)
    const timer = setTimeout(async () => {
      const config = this.limits[provider];
      await limiter.updateSettings({ reservoir: config.reservoir });
      logger.info(`Resumed ${provider} after rate limit pause`, { provider });
      this._pauseTimers.delete(provider);
    }, durationMs);

    // Unref so it doesn't prevent process exit
    if (timer.unref) {
      timer.unref();
    }

    this._pauseTimers.set(provider, timer);
  }

  /**
   * Stop the rate limiter manager
   */
  stop() {
    if (this._loggingInterval) {
      clearInterval(this._loggingInterval);
      this._loggingInterval = null;
    }

    // Clear all pause timers
    for (const timer of this._pauseTimers.values()) {
      clearTimeout(timer);
    }
    this._pauseTimers.clear();

    for (const limiter of this.limiters.values()) {
      limiter.stop();
    }

    logger.info('RateLimiterManager stopped');
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create the singleton RateLimiterManager
 * @param {Object} [customLimits] - Custom limit overrides (only used on first call)
 * @returns {RateLimiterManager}
 */
function getRateLimiterManager(customLimits) {
  if (!instance) {
    instance = new RateLimiterManager(customLimits);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
function resetRateLimiterManager() {
  if (instance) {
    instance.stop();
    instance = null;
  }
}

module.exports = {
  RateLimiterManager,
  getRateLimiterManager,
  resetRateLimiterManager,
  DEFAULT_LIMITS,
  TOKEN_COSTS,
};
