/**
 * Provider Chain
 *
 * Priority-based LLM provider chain with automatic fallback.
 * Tries providers in order until one succeeds or all fail.
 *
 * @module providers/llm/providerChain
 */

const { shouldFallback, parseRetryAfter } = require('./contracts');
const { logger } = require('../../observability');
const { getRateLimiterManager } = require('./rateLimiter');

/**
 * Provider chain for LLM requests with fallback support
 */
class ProviderChain {
  /**
   * @param {import('./adapters/baseAdapter').BaseAdapter[]} adapters - Ordered list of adapters (first = highest priority)
   * @param {Object} [options]
   * @param {number} [options.maxRetries=2] - Max retries per provider before fallback
   * @param {number} [options.retryDelayMs=1000] - Base delay between retries
   */
  constructor(adapters, options = {}) {
    this.adapters = adapters.filter((a) => a.isAvailable());
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;

    if (this.adapters.length === 0) {
      throw new Error('No LLM providers available. Check API key configuration.');
    }

    logger.info('ProviderChain initialized', {
      providers: this.adapters.map((a) => a.getProviderName()),
      primaryProvider: this.adapters[0]?.getProviderName(),
    });
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

    for (let i = 0; i < this.adapters.length; i++) {
      const adapter = this.adapters[i];
      const providerName = adapter.getProviderName();
      const isLastProvider = i === this.adapters.length - 1;

      try {
        const result = await this._executeWithRetry(adapter, messages, options);

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
        errors.push({
          provider: providerName,
          error: error.message,
          shouldFallback: error.shouldFallback ?? shouldFallback(error),
        });

        logger.warn('LLM provider failed, attempting fallback', {
          provider: providerName,
          model: adapter.model,
          providerIndex: i + 1,
          totalProviders: this.adapters.length,
          nextProvider: !isLastProvider ? this.adapters[i + 1]?.getProviderName() : null,
          error: error.message,
          errorCode: error.status || 'UNKNOWN',
          errorCategory: this._categorizeError(error),
          shouldFallback: error.shouldFallback ?? shouldFallback(error),
          isLastProvider,
          operation: options.operation || 'chatCompletion',
          latencyMs: Date.now() - startTime,
        });

        // Only fallback if error is fallback-eligible
        if (!error.shouldFallback && !shouldFallback(error)) {
          // Non-recoverable error (bad request, etc.) - don't try other providers
          throw error;
        }

        // If this is the last provider, throw aggregated error
        if (isLastProvider) {
          const aggregatedError = new Error(
            `All LLM providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}`,
          );
          aggregatedError.errors = errors;
          aggregatedError.latencyMs = Date.now() - startTime;
          throw aggregatedError;
        }
      }
    }

    // Should never reach here, but just in case
    throw new Error('No LLM providers available');
  }

  /**
   * Execute with retry logic for a single provider
   * @private
   */
  async _executeWithRetry(adapter, messages, options) {
    let lastError;
    const providerName = adapter.getProviderName();
    const model = adapter.model;
    const rateLimiter = getRateLimiterManager();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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
          },
        );

        // Execute through rate limiter
        const result = await rateLimiter.schedule(providerName, async () => {
          return adapter.chatCompletion(messages, options);
        });

        // Record usage for tracking
        if (result.usage) {
          rateLimiter.recordUsage(providerName, result.model, result.usage);
        }

        return result;
      } catch (error) {
        lastError = error;

        const willRetry = shouldFallback(error) && attempt < this.maxRetries;

        // Log detailed failure info with provider/model/attempt
        logger.warn(
          `LLM attempt FAILED [${providerName}/${model}] attempt=${attempt}/${this.maxRetries} status=${error.status || 'UNKNOWN'}`,
          {
            provider: providerName,
            model,
            attempt,
            maxRetries: this.maxRetries,
            errorMessage: error.message,
            errorStatus: error.status || 'UNKNOWN',
            willRetry,
            operation: options.operation || 'chatCompletion',
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
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Categorize error for logging and metrics
   * @private
   * @param {Error} error
   * @returns {string}
   */
  _categorizeError(error) {
    const status = error.status;
    const message = (error.message || '').toLowerCase();

    if (status === 429 || message.includes('rate limit') || message.includes('quota')) {
      return 'rate_limit';
    }
    if (
      status === 401 ||
      status === 403 ||
      message.includes('auth') ||
      message.includes('invalid api key')
    ) {
      return 'auth_error';
    }
    if (status >= 500 || message.includes('server error') || message.includes('internal')) {
      return 'server_error';
    }
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      error.name === 'AbortError'
    ) {
      return 'timeout';
    }
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('socket')
    ) {
      return 'network_error';
    }
    if (status === 400 || message.includes('bad request') || message.includes('invalid')) {
      return 'bad_request';
    }
    return 'unknown';
  }

  /**
   * Health check all providers
   * @returns {Promise<import('./contracts').ProviderHealth[]>}
   */
  async healthCheck() {
    return Promise.all(this.adapters.map((adapter) => adapter.healthCheck()));
  }
}

module.exports = { ProviderChain };
