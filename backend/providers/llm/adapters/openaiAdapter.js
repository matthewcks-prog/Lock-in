/**
 * OpenAI Adapter
 *
 * Adapter for OpenAI's Chat Completions API.
 * Fallback provider when primary (Gemini) fails.
 *
 * @module providers/llm/adapters/openaiAdapter
 */

const OpenAI = require('openai');
const { BaseAdapter } = require('./baseAdapter');

const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 60000;

/**
 * OpenAI API adapter
 * @extends BaseAdapter
 */
class OpenAIAdapter extends BaseAdapter {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - OpenAI API key
   * @param {string} [config.model] - Model name (default: gpt-4o-mini)
   */
  constructor(config) {
    super(config);
    this._name = 'openai';
    this.model = config.model || DEFAULT_MODEL;

    if (this.isAvailable()) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 2,
      });
    }
  }

  /**
   * Check if provider is available
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(this.config?.apiKey);
  }

  /**
   * Execute chat completion via OpenAI SDK
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('../contracts').ChatCompletionResult>}
   */
  async chatCompletion(messages, options = {}) {
    if (!this.client) {
      throw this.wrapError(
        'chatCompletion',
        new Error('OpenAI client not initialized - missing API key'),
      );
    }

    try {
      const requestParams = {
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      };

      // Add JSON mode if requested
      if (options.responseFormat) {
        requestParams.response_format = options.responseFormat;
      }

      const response = await this.client.chat.completions.create(requestParams);

      const choice = response.choices?.[0];
      if (!choice?.message?.content) {
        throw this.wrapError('chatCompletion', new Error('No content in OpenAI response'));
      }

      return {
        content: choice.message.content,
        provider: this.getProviderName(),
        model: response.model,
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens || 0,
              completion_tokens: response.usage.completion_tokens || 0,
              total_tokens: response.usage.total_tokens || 0,
            }
          : null,
      };
    } catch (error) {
      if (error.provider === this.getProviderName()) {
        throw error; // Already wrapped
      }
      throw this.wrapError('chatCompletion', error);
    }
  }
}

module.exports = { OpenAIAdapter };
