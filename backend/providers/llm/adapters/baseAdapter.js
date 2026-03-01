/**
 * Base LLM Adapter
 *
 * Abstract base class for all LLM provider adapters.
 * Enforces the contract and provides shared utilities.
 *
 * @module providers/llm/adapters/baseAdapter
 */

const { createProviderError } = require('../contracts');

/**
 * Base adapter class - all provider adapters must extend this
 * @abstract
 */
class BaseAdapter {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - API key for the provider
   * @param {string} [config.model] - Model to use
   */
  constructor(config) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly');
    }

    this.config = config;
    this._name = 'base';
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getProviderName() {
    return this._name;
  }

  /**
   * Check if provider is available (has required config)
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(this.config?.apiKey);
  }

  /**
   * Get model name (for logging purposes)
   * @returns {string}
   */
  getModel() {
    return this.model || 'unknown';
  }

  /**
   * Execute chat completion
   * @abstract
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('../contracts').ChatCompletionResult>}
   */

  async chatCompletion(messages, _options = {}) {
    throw new Error('chatCompletion must be implemented by subclass');
  }

  /**
   * Execute streaming chat completion
   * Returns an async generator that yields chunks.
   * Default implementation falls back to non-streaming (yields single final chunk).
   *
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {AsyncGenerator<import('../contracts').ProviderStreamChunk>}
   */
  async *chatCompletionStream(messages, options = {}) {
    // Default fallback: use non-streaming and yield as single final chunk
    const result = await this.chatCompletion(messages, options);
    yield {
      type: 'final',
      content: result.content,
      usage: result.usage,
    };
  }

  /**
   * Check if this adapter supports native streaming
   * @returns {boolean}
   */
  supportsStreaming() {
    return false;
  }

  /**
   * Check provider health
   * @returns {Promise<import('../contracts').ProviderHealth>}
   */
  async healthCheck() {
    try {
      await this.chatCompletion([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
      return {
        available: true,
        provider: this.getProviderName(),
      };
    } catch (error) {
      return {
        available: false,
        provider: this.getProviderName(),
        error: error.message,
      };
    }
  }

  /**
   * Wrap errors with provider context
   * @protected
   * @param {string} operation
   * @param {Error} error
   * @returns {Error}
   */
  wrapError(operation, error) {
    return createProviderError(this.getProviderName(), operation, error);
  }
}

module.exports = { BaseAdapter };
