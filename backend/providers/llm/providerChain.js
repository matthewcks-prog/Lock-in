/**
 * Provider Chain
 *
 * Priority-based LLM provider chain with automatic fallback.
 * Tries providers in order until one succeeds or all fail.
 *
 * @module providers/llm/providerChain
 */

const { AppError } = require('../../errors');
const { logger } = require('../../observability');
const HTTP_STATUS = require('../../constants/httpStatus');
const { THIRTY, THOUSAND } = require('../../constants/numbers');
const { CircuitBreaker } = require('./circuitBreaker');
const { getRateLimiterManager } = require('./rateLimiter');
const { MIN_REMAINING_MS } = require('./providerChainUtils');
const { executeChatCompletion } = require('./providerChainChatExecutor');
const { executeChatCompletionStream } = require('./providerChainStreamExecutor');

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const immediateSleep = () => Promise.resolve();

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = THOUSAND;
const DEFAULT_QUEUE_TIMEOUT_MS = THIRTY * THOUSAND;

function ensureAdaptersAvailable(adapters) {
  if (adapters.length > 0) {
    return;
  }

  throw new AppError(
    'No LLM providers available. Check API key configuration.',
    'SERVICE_UNAVAILABLE',
    HTTP_STATUS.SERVICE_UNAVAILABLE,
  );
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
    this.adapters = adapters.filter((adapter) => adapter.isAvailable());
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this._sleep = options.sleep ?? defaultSleep;
    this._rateLimiter = options.rateLimiter ?? null;
    this.overallTimeoutMs = options.overallTimeoutMs;
    this.attemptTimeoutMs = options.attemptTimeoutMs;
    this.queueTimeoutMs = options.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS;
    this.minRemainingMs = options.minRemainingMs ?? MIN_REMAINING_MS;
    this._circuitBreaker =
      options.circuitBreaker ?? new CircuitBreaker(options.circuitBreakerOptions);

    ensureAdaptersAvailable(this.adapters);

    logger.info('ProviderChain initialized', {
      providers: this.adapters.map((adapter) => adapter.getProviderName()),
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
    return this.adapters.map((adapter) => adapter.getProviderName());
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
    return executeChatCompletion({
      chain: this,
      messages,
      options,
    });
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
    yield* executeChatCompletionStream({
      chain: this,
      messages,
      options,
    });
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
  defaultSleep,
  immediateSleep,
};
