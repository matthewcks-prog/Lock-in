const Bottleneck = require('bottleneck');
const { RateLimitError } = require('../../errors');
const { logger } = require('../../observability');
const { UsageTracker } = require('./rateLimiterUsageTracker');
const {
  RATE_LIMITER_CONSTANTS,
  DEFAULT_LIMITS,
  TEST_LIMITS,
  TOKEN_COSTS,
} = require('./rateLimiterConfig');

class RateLimiterManager {
  #stopped = false;

  constructor(customLimits = {}) {
    this.limiters = new Map();
    this.limits = { ...DEFAULT_LIMITS, ...customLimits };
    this.usageTracker = new UsageTracker();
    this._loggingInterval = null;
    this._pauseTimers = new Map();
    this.#stopped = false;

    for (const [provider, config] of Object.entries(this.limits)) {
      this.limiters.set(provider, this._createLimiter(provider, config));
    }

    if (this._hasRefreshIntervals()) {
      this._startUsageLogging();
    }

    logger.info('RateLimiterManager initialized', {
      providers: Object.keys(this.limits),
    });
  }

  isStopped() {
    return this.#stopped;
  }

  _hasRefreshIntervals() {
    return Object.values(this.limits).some(
      (limit) =>
        limit.reservoirRefreshInterval !== null && limit.reservoirRefreshInterval !== undefined,
    );
  }

  _createLimiter(provider, config) {
    const limiter = new Bottleneck(config);

    limiter.on('queued', () => {
      const counts = limiter.counts();
      if (counts.QUEUED > RATE_LIMITER_CONSTANTS.queueWarningThreshold) {
        logger.warn(`Rate limiter queue growing for ${provider}`, {
          provider,
          queued: counts.QUEUED,
          running: counts.RUNNING,
        });
      }
    });

    limiter.on('dropped', (dropped) => {
      logger.error(`Rate limiter dropped request for ${provider}`, {
        provider,
        dropped: dropped?.options?.id || RATE_LIMITER_CONSTANTS.unknownDroppedJobId,
      });
    });

    limiter.on('error', (error) => {
      logger.error(`Rate limiter error for ${provider}`, {
        provider,
        error: error.message,
      });
    });

    return limiter;
  }

  _startUsageLogging() {
    this._loggingInterval = setInterval(() => {
      const stats = this.usageTracker.getStats();
      if (stats.totalRequests > 0) {
        logger.info('LLM usage stats', {
          uptimeMinutes: Math.round(stats.uptimeMs / RATE_LIMITER_CONSTANTS.uptimeMinuteMs),
          totalRequests: stats.totalRequests,
          totalTokens: stats.totalTokens,
          totalCostUsd: stats.totalCostUsd,
          models: stats.models,
        });
      }
    }, RATE_LIMITER_CONSTANTS.usageLogIntervalMs);

    if (this._loggingInterval.unref) {
      this._loggingInterval.unref();
    }
  }

  _createQueueFullError(provider) {
    const error = new RateLimitError(
      `Rate limit queue full for ${provider}. Try again in a few seconds.`,
      RATE_LIMITER_CONSTANTS.queueFullRetryAfterSeconds,
    );
    error.shouldFallback = true;
    return error;
  }

  _createQueueTimeoutError(provider) {
    const error = new RateLimitError(
      `Request queued too long for ${provider}. Try again later.`,
      RATE_LIMITER_CONSTANTS.queueTimeoutRetryAfterSeconds,
    );
    error.shouldFallback = true;
    return error;
  }

  _normalizeScheduleError(provider, error) {
    if (error?.message?.includes(RATE_LIMITER_CONSTANTS.droppedJobMessage)) {
      return this._createQueueFullError(provider);
    }

    if (error?.message?.includes(RATE_LIMITER_CONSTANTS.timedOutJobMessage)) {
      return this._createQueueTimeoutError(provider);
    }

    return error;
  }

  _assertQueueHasCapacity(provider, limiter) {
    const counts = limiter.counts();
    const config = this.limits[provider];

    if (counts.QUEUED >= config.highWater) {
      throw this._createQueueFullError(provider);
    }
  }

  _buildScheduleRequest(provider, options) {
    return {
      priority: options.priority ?? RATE_LIMITER_CONSTANTS.defaultPriority,
      timeout: options.timeout ?? RATE_LIMITER_CONSTANTS.defaultQueueTimeoutMs,
      id: `${provider}-${Date.now()}`,
    };
  }

  _scheduleWithoutLimiter(provider, fn) {
    logger.warn(`No rate limiter configured for ${provider}, executing directly`);
    return fn();
  }

  async schedule(provider, fn, options = {}) {
    const limiter = this.limiters.get(provider);
    if (!limiter) {
      return this._scheduleWithoutLimiter(provider, fn);
    }

    const request = this._buildScheduleRequest(provider, options);
    this._assertQueueHasCapacity(provider, limiter);

    try {
      return await limiter.schedule(
        {
          priority: request.priority,
          expiration: request.timeout,
          id: request.id,
        },
        fn,
      );
    } catch (error) {
      throw this._normalizeScheduleError(provider, error);
    }
  }

  recordUsage(provider, model, usage) {
    this.usageTracker.record(provider, model, usage);
  }

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

  getUsageStats() {
    return this.usageTracker.getStats();
  }

  async pauseProvider(provider, durationMs) {
    const limiter = this.limiters.get(provider);
    if (!limiter) {
      return;
    }

    logger.info(`Pausing ${provider} for ${durationMs}ms due to rate limit`, {
      provider,
      durationMs,
    });

    await limiter.updateSettings({ reservoir: RATE_LIMITER_CONSTANTS.pausedReservoir });

    if (this._pauseTimers.has(provider)) {
      clearTimeout(this._pauseTimers.get(provider));
    }

    const timer = setTimeout(async () => {
      const config = this.limits[provider];
      await limiter.updateSettings({ reservoir: config.reservoir });
      logger.info(`Resumed ${provider} after rate limit pause`, { provider });
      this._pauseTimers.delete(provider);
    }, durationMs);

    if (timer.unref) {
      timer.unref();
    }

    this._pauseTimers.set(provider, timer);
  }

  _clearLoggingInterval() {
    if (!this._loggingInterval) {
      return;
    }

    clearInterval(this._loggingInterval);
    this._loggingInterval = null;
  }

  _clearPauseTimers() {
    for (const timer of this._pauseTimers.values()) {
      clearTimeout(timer);
    }
    this._pauseTimers.clear();
  }

  async stop() {
    if (this.#stopped) {
      return;
    }

    this._clearLoggingInterval();
    this._clearPauseTimers();

    const stopPromises = [];
    for (const limiter of this.limiters.values()) {
      stopPromises.push(limiter.stop({ dropWaitingJobs: true }));
    }
    await Promise.all(stopPromises);

    for (const limiter of this.limiters.values()) {
      if (limiter.disconnect) {
        limiter.disconnect();
      }
    }

    this.limiters.clear();
    this.#stopped = true;
    logger.info('RateLimiterManager stopped');
  }

  forceCleanup() {
    if (this.#stopped) {
      return;
    }

    this._clearLoggingInterval();
    this._clearPauseTimers();

    for (const limiter of this.limiters.values()) {
      try {
        limiter.stop({ dropWaitingJobs: true }).catch(() => {});
        if (limiter.disconnect) {
          limiter.disconnect();
        }
      } catch {
        // Ignore errors during force cleanup.
      }
    }

    this.limiters.clear();
    this.#stopped = true;
  }
}

let instance = null;

function getRateLimiterManager(customLimits) {
  if (!instance) {
    instance = new RateLimiterManager(customLimits);
  }
  return instance;
}

function getTestRateLimiterManager() {
  if (!instance) {
    instance = new RateLimiterManager(TEST_LIMITS);
  }
  return instance;
}

async function resetRateLimiterManager() {
  if (instance) {
    await instance.stop();
    instance = null;
  }
}

function forceResetRateLimiterManager() {
  if (instance) {
    instance.forceCleanup();
    instance = null;
  }
}

async function drainEventLoop(iterations = RATE_LIMITER_CONSTANTS.eventLoopDrainIterations) {
  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line no-undef -- setImmediate is a Node.js global
    await new Promise((resolve) => setImmediate(resolve));
  }
  await Promise.resolve();
}

module.exports = {
  RateLimiterManager,
  getRateLimiterManager,
  getTestRateLimiterManager,
  resetRateLimiterManager,
  forceResetRateLimiterManager,
  drainEventLoop,
  DEFAULT_LIMITS,
  TEST_LIMITS,
  TOKEN_COSTS,
};
