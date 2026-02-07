/**
 * Provider Chain
 *
 * Priority-based LLM provider chain with automatic fallback.
 * Tries providers in order until one succeeds or all fail.
 *
 * @module providers/llm/providerChain
 */

const { shouldFallback, parseRetryAfter, createStreamErrorChunk } = require('./contracts');
const { AppError } = require('../../errors');
const { logger } = require('../../observability');
const { CircuitBreaker } = require('./circuitBreaker');
const { getRateLimiterManager } = require('./rateLimiter');
const {
  createDeadlineExceededError,
  createRequestBudget,
  isAbortError,
  isDeadlineExceededError,
} = require('./requestBudget');
const {
  MIN_REMAINING_MS,
  attachChainContext,
  buildDeadlineError,
  categorizeError,
  getErrorStatus,
  resolveAttemptTimeoutMs,
  resolveQueueTimeoutMs,
} = require('./providerChainUtils');

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const immediateSleep = () => Promise.resolve();

function createCircuitOpenError(providerName, decision) {
  const error = new AppError(
    `LLM provider ${providerName} temporarily unavailable (circuit open)`,
    'SERVICE_UNAVAILABLE',
    503,
    {
      provider: providerName,
      retryAfterMs: decision.retryAfterMs,
      circuitState: decision.state,
    },
  );
  error.name = 'CircuitOpenError';
  error.shouldFallback = true;
  return error;
}

/**
 * Provider chain for LLM requests with fallback support
 */
class ProviderChain {
  /**
   * @param {import('./adapters/baseAdapter').BaseAdapter[]} adapters - Ordered list of adapters (first = highest priority)
   * @param {Object} [options]
   * @param {number} [options.maxRetries=2] - Max retries per provider before fallback
   * @param {number} [options.retryDelayMs=1000] - Base delay between retries
   * @param {Function} [options.sleep] - Custom sleep function for testing (default: real setTimeout)
   * @param {import('./rateLimiter').RateLimiterManager} [options.rateLimiter] - Injected rate limiter (default: singleton)
   */
  constructor(adapters, options = {}) {
    this.adapters = adapters.filter((a) => a.isAvailable());
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this._sleep = options.sleep ?? defaultSleep;
    // Support dependency injection for testing isolation
    this._rateLimiter = options.rateLimiter ?? null;
    this.overallTimeoutMs = options.overallTimeoutMs;
    this.attemptTimeoutMs = options.attemptTimeoutMs;
    this.queueTimeoutMs = options.queueTimeoutMs ?? 30000;
    this.minRemainingMs = options.minRemainingMs ?? MIN_REMAINING_MS;
    this._circuitBreaker =
      options.circuitBreaker ?? new CircuitBreaker(options.circuitBreakerOptions);

    if (this.adapters.length === 0) {
      throw new AppError(
        'No LLM providers available. Check API key configuration.',
        'SERVICE_UNAVAILABLE',
        503,
      );
    }

    logger.info('ProviderChain initialized', {
      providers: this.adapters.map((a) => a.getProviderName()),
      primaryProvider: this.adapters[0]?.getProviderName(),
    });
  }

  /**
   * Get the rate limiter (injected or global singleton)
   * @private
   * @returns {import('./rateLimiter').RateLimiterManager}
   */
  _getRateLimiter() {
    return this._rateLimiter ?? getRateLimiterManager();
  }

  /**
   * Get list of available providers
   * @returns {string[]}
   */
  getAvailableProviders() {
    return this.adapters.map((a) => a.getProviderName());
  }

  /**
   * Get primary (first) provider name
   * @returns {string}
   */
  getPrimaryProvider() {
    return this.adapters[0]?.getProviderName() || 'none';
  }

  /**
   * Execute chat completion with automatic fallback
   * @param {import('./contracts').ChatMessage[]} messages
   * @param {import('./contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('./contracts').ChatCompletionResult>}
   */
  async chatCompletion(messages, options = {}) {
    const errors = [];
    const startTime = Date.now();
    const budget = createRequestBudget({
      timeoutMs: options.overallTimeoutMs ?? this.overallTimeoutMs,
      signal: options.signal,
    });

    try {
      for (let i = 0; i < this.adapters.length; i++) {
        const adapter = this.adapters[i];
        const providerName = adapter.getProviderName();
        const isLastProvider = i === this.adapters.length - 1;
        const remainingProviders = this.adapters.length - i;
        const remainingMs = budget.remainingMs();

        if (budget.isExpired() || remainingMs <= this.minRemainingMs) {
          throw buildDeadlineError(budget, errors, startTime);
        }

        const circuitDecision = await this._circuitBreaker.canRequest(providerName);
        if (!circuitDecision.allowed) {
          const circuitError = createCircuitOpenError(providerName, circuitDecision);
          errors.push({
            provider: providerName,
            error: circuitError.message,
            shouldFallback: true,
            abortLike: false,
            circuitOpen: true,
          });

          logger.warn('LLM provider skipped due to open circuit', {
            provider: providerName,
            providerIndex: i + 1,
            totalProviders: this.adapters.length,
            retryAfterMs: circuitDecision.retryAfterMs,
            remainingBudgetMs: remainingMs,
          });

          if (isLastProvider) {
            throw attachChainContext(circuitError, errors, startTime);
          }
          continue;
        }

        try {
          const result = await this._executeWithRetry(
            adapter,
            messages,
            options,
            budget,
            remainingProviders,
          );

          await this._circuitBreaker.recordSuccess(providerName);

          // Log success with comprehensive details
          logger.info(`LLM request succeeded [${providerName}/${result.model}]`, {
            provider: providerName,
            model: result.model,
            operation: options.operation || 'chatCompletion',
            latencyMs: Date.now() - startTime,
            providerIndex: i + 1,
            totalProviders: this.adapters.length,
            fallbackUsed: i > 0,
            attemptedProviders: errors.map((e) => e.provider),
            usage: result.usage,
          });

          return {
            ...result,
            fallbackUsed: i > 0,
            attemptedProviders: errors.map((e) => e.provider),
          };
        } catch (error) {
          const abortLike =
            isAbortError(error) || isDeadlineExceededError(error) || budget.isExpired();
          const errorCategory = categorizeError(error);
          const errorStatus = getErrorStatus(error);
          const fallbackEligible = abortLike
            ? false
            : (error.shouldFallback ?? shouldFallback(error));
          const shouldRecordFailure =
            !abortLike &&
            (fallbackEligible ||
              ['rate_limit', 'server_error', 'network_error', 'timeout'].includes(errorCategory));

          errors.push({
            provider: providerName,
            error: error.message,
            shouldFallback: fallbackEligible,
            abortLike,
          });

          if (shouldRecordFailure) {
            const breakerState = await this._circuitBreaker.recordFailure(providerName);
            if (breakerState.opened) {
              logger.warn('LLM provider circuit opened', {
                provider: providerName,
                failures: breakerState.failures,
                failureThreshold: this._circuitBreaker.failureThreshold,
                openDurationMs: this._circuitBreaker.openDurationMs,
              });
            }
          }

          logger.warn('LLM provider failed, attempting fallback', {
            provider: providerName,
            model: adapter.model,
            providerIndex: i + 1,
            totalProviders: this.adapters.length,
            nextProvider: !isLastProvider ? this.adapters[i + 1]?.getProviderName() : null,
            error: error.message,
            errorCode: errorStatus || 'UNKNOWN',
            errorCategory,
            shouldFallback: fallbackEligible,
            isLastProvider,
            operation: options.operation || 'chatCompletion',
            latencyMs: Date.now() - startTime,
            remainingBudgetMs: remainingMs,
          });

          if (abortLike) {
            throw attachChainContext(error, errors, startTime);
          }

          // Only fallback if error is fallback-eligible
          if (!fallbackEligible) {
            throw attachChainContext(error, errors, startTime);
          }

          // If this is the last provider, throw aggregated error
          if (isLastProvider) {
            const aggregatedError = new AppError(
              `All LLM providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}`,
              'SERVICE_UNAVAILABLE',
              503,
            );
            throw attachChainContext(aggregatedError, errors, startTime);
          }
        }
      }
    } finally {
      budget.dispose();
    }

    // Should never reach here, but just in case
    throw new AppError('No LLM providers available', 'SERVICE_UNAVAILABLE', 503);
  }

  /**
   * Execute with retry logic for a single provider
   * @private
   */
  async _executeWithRetry(adapter, messages, options, budget, remainingProviders) {
    let lastError;
    const providerName = adapter.getProviderName();
    const model = adapter.model;
    const rateLimiter = this._getRateLimiter();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      if (budget.isExpired()) {
        throw createDeadlineExceededError(budget.timeoutMs, budget.signal?.reason);
      }

      const remainingMs = budget.remainingMs();
      if (Number.isFinite(remainingMs) && remainingMs <= this.minRemainingMs) {
        throw createDeadlineExceededError(budget.timeoutMs, budget.signal?.reason);
      }

      const attemptTimeoutMs = resolveAttemptTimeoutMs({
        remainingMs,
        remainingProviders,
        optionsTimeoutMs: options.timeoutMs,
        attemptTimeoutMs: this.attemptTimeoutMs,
        minRemainingMs: this.minRemainingMs,
      });
      const queueTimeoutMs = resolveQueueTimeoutMs({
        remainingMs,
        remainingProviders,
        optionsQueueTimeoutMs: options.queueTimeoutMs,
        queueTimeoutMs: this.queueTimeoutMs,
        minRemainingMs: this.minRemainingMs,
      });

      try {
        // Log attempt start for diagnostics
        logger.info(
          `LLM attempt [${providerName}/${model}] attempt=${attempt}/${this.maxRetries}`,
          {
            provider: providerName,
            model,
            attempt,
            maxRetries: this.maxRetries,
            operation: options.operation || 'chatCompletion',
            attemptTimeoutMs,
            queueTimeoutMs,
          },
        );

        // Execute through rate limiter
        const requestOptions = { ...options, signal: budget.signal };
        if (Number.isFinite(attemptTimeoutMs)) {
          requestOptions.timeoutMs = attemptTimeoutMs;
        }

        const scheduleOptions = Number.isFinite(queueTimeoutMs)
          ? { timeout: queueTimeoutMs }
          : undefined;

        const result = await rateLimiter.schedule(
          providerName,
          async () => adapter.chatCompletion(messages, requestOptions),
          scheduleOptions,
        );

        // Record usage for tracking
        if (result.usage) {
          rateLimiter.recordUsage(providerName, result.model, result.usage);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (isAbortError(error) || isDeadlineExceededError(error)) {
          error.shouldFallback = false;
          throw error;
        }

        const willRetry = shouldFallback(error) && attempt < this.maxRetries;
        const errorStatus = getErrorStatus(error);

        // Log detailed failure info with provider/model/attempt
        logger.warn(
          `LLM attempt FAILED [${providerName}/${model}] attempt=${attempt}/${this.maxRetries} status=${errorStatus || 'UNKNOWN'}`,
          {
            provider: providerName,
            model,
            attempt,
            maxRetries: this.maxRetries,
            errorMessage: error.message,
            errorStatus: errorStatus || 'UNKNOWN',
            willRetry,
            operation: options.operation || 'chatCompletion',
            remainingBudgetMs: budget.remainingMs(),
          },
        );

        // Don't retry on non-retryable errors
        if (!shouldFallback(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Check for Retry-After and pause provider if needed
        const retryAfter = parseRetryAfter(error);
        if (retryAfter && retryAfter > 0) {
          // Pause this provider's rate limiter
          await rateLimiter.pauseProvider(providerName, retryAfter * 1000);
        }

        // Exponential backoff with jitter (respect Retry-After if present)
        const baseDelay = retryAfter
          ? retryAfter * 1000
          : this.retryDelayMs * Math.pow(2, attempt - 1);
        const delay = baseDelay * (0.5 + Math.random() * 0.5);
        const remainingMsAfterDelay = budget.remainingMs() - delay;
        if (
          Number.isFinite(remainingMsAfterDelay) &&
          remainingMsAfterDelay <= this.minRemainingMs
        ) {
          throw createDeadlineExceededError(budget.timeoutMs, budget.signal?.reason);
        }
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute streaming chat completion with automatic fallback
   *
   * Unlike non-streaming chatCompletion, streaming does NOT retry mid-stream.
   * If a provider fails during streaming, the stream yields an error chunk and terminates.
   * Fallback only occurs at initialization (before any chunks are yielded).
   *
   * @param {import('./contracts').ChatMessage[]} messages
   * @param {import('./contracts').ChatCompletionOptions} [options]
   * @returns {AsyncGenerator<import('./contracts').ProviderStreamChunk>}
   */
  async *chatCompletionStream(messages, options = {}) {
    const errors = [];
    const startTime = Date.now();
    const budget = createRequestBudget({
      timeoutMs: options.overallTimeoutMs ?? this.overallTimeoutMs,
      signal: options.signal,
    });

    let selectedAdapter = null;
    let selectedProviderName = null;

    try {
      // Phase 1: Find a working provider (with fallback)
      for (let i = 0; i < this.adapters.length; i++) {
        const adapter = this.adapters[i];
        const providerName = adapter.getProviderName();
        const isLastProvider = i === this.adapters.length - 1;
        const remainingMs = budget.remainingMs();

        if (budget.isExpired() || remainingMs <= this.minRemainingMs) {
          yield createStreamErrorChunk('TIMEOUT', 'Request deadline exceeded', false);
          return;
        }

        // Check circuit breaker
        const circuitDecision = await this._circuitBreaker.canRequest(providerName);
        if (!circuitDecision.allowed) {
          errors.push({
            provider: providerName,
            error: 'Circuit breaker open',
            circuitOpen: true,
          });

          logger.warn('LLM streaming: provider skipped (circuit open)', {
            provider: providerName,
            providerIndex: i + 1,
            totalProviders: this.adapters.length,
          });

          if (isLastProvider) {
            yield createStreamErrorChunk('SERVICE_UNAVAILABLE', 'All providers unavailable', true);
            return;
          }
          continue;
        }

        // Try to acquire rate limiter slot
        const rateLimiter = this._getRateLimiter();
        const queueTimeoutMs = resolveQueueTimeoutMs({
          remainingMs,
          remainingProviders: this.adapters.length - i,
          optionsQueueTimeoutMs: options.queueTimeoutMs,
          queueTimeoutMs: this.queueTimeoutMs,
          minRemainingMs: this.minRemainingMs,
        });

        try {
          // Use rate limiter to schedule the stream initialization
          await rateLimiter.schedule(
            providerName,
            async () => {
              // Just acquiring the slot - actual streaming happens outside
              return true;
            },
            Number.isFinite(queueTimeoutMs) ? { timeout: queueTimeoutMs } : undefined,
          );

          selectedAdapter = adapter;
          selectedProviderName = providerName;
          break;
        } catch (error) {
          errors.push({
            provider: providerName,
            error: error.message,
          });

          logger.warn('LLM streaming: provider rate limited', {
            provider: providerName,
            providerIndex: i + 1,
            error: error.message,
          });

          if (isLastProvider) {
            yield createStreamErrorChunk('RATE_LIMIT', 'All providers rate limited', true);
            return;
          }
        }
      }

      if (!selectedAdapter) {
        yield createStreamErrorChunk('SERVICE_UNAVAILABLE', 'No providers available', false);
        return;
      }

      // Phase 2: Stream from selected provider (no mid-stream fallback)
      logger.info(`LLM streaming started [${selectedProviderName}]`, {
        provider: selectedProviderName,
        model: selectedAdapter.model,
        operation: options.operation || 'chatCompletionStream',
      });

      const streamOptions = {
        ...options,
        signal: budget.signal,
        timeoutMs: options.timeoutMs ?? budget.remainingMs(),
      };

      let chunkCount = 0;
      let errorOccurred = false;

      try {
        for await (const chunk of selectedAdapter.chatCompletionStream(messages, streamOptions)) {
          chunkCount++;

          if (chunk.type === 'error') {
            errorOccurred = true;
            await this._circuitBreaker.recordFailure(selectedProviderName);
            yield chunk;
            break;
          }

          yield chunk;

          // Record usage from final chunk
          if (chunk.type === 'final' && chunk.usage) {
            this._getRateLimiter().recordUsage(
              selectedProviderName,
              selectedAdapter.model,
              chunk.usage,
            );
          }
        }

        if (!errorOccurred) {
          await this._circuitBreaker.recordSuccess(selectedProviderName);

          logger.info(`LLM streaming completed [${selectedProviderName}]`, {
            provider: selectedProviderName,
            model: selectedAdapter.model,
            chunkCount,
            latencyMs: Date.now() - startTime,
          });
        }
      } catch (error) {
        // Stream failed mid-way
        await this._circuitBreaker.recordFailure(selectedProviderName);

        const isAbort = isAbortError(error) || isDeadlineExceededError(error);
        const errorCode = isAbort ? 'ABORTED' : 'UPSTREAM_ERROR';
        const retryable = !isAbort && shouldFallback(error);

        logger.error(`LLM streaming failed [${selectedProviderName}]`, {
          provider: selectedProviderName,
          model: selectedAdapter.model,
          error: error.message,
          chunkCount,
          latencyMs: Date.now() - startTime,
          isAbort,
        });

        yield createStreamErrorChunk(errorCode, error.message, retryable);
      }
    } finally {
      budget.dispose();
    }
  }

  /**
   * Health check all providers
   * @returns {Promise<import('./contracts').ProviderHealth[]>}
   */
  async healthCheck() {
    return Promise.all(this.adapters.map((adapter) => adapter.healthCheck()));
  }
}

module.exports = {
  ProviderChain,
  // Export sleep functions for testing
  defaultSleep,
  immediateSleep,
};
