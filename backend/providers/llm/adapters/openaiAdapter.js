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
const { parseOpenAiResponse } = require('../responseSchemas');
const { resolveTimeoutMs } = require('../requestBudget');

const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 60000;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

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
        maxRetries: 0,
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

  _requireClient() {
    if (this.client) {
      return this.client;
    }

    throw this.wrapError(
      'chatCompletion',
      new Error('OpenAI client not initialized - missing API key'),
    );
  }

  _buildRequestParams(messages, options) {
    const requestParams = {
      model: this.model,
      messages,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    if (options.responseFormat) {
      requestParams.response_format = options.responseFormat;
    }

    return requestParams;
  }

  _buildRequestOptions(options) {
    const requestOptions = {};
    const timeoutMs = resolveTimeoutMs(options.timeoutMs, REQUEST_TIMEOUT_MS);

    if (Number.isFinite(timeoutMs)) {
      requestOptions.timeout = timeoutMs;
    }

    if (options.signal) {
      requestOptions.signal = options.signal;
    }

    return requestOptions;
  }

  _extractUsage(usage) {
    if (!usage) {
      return null;
    }

    return {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    };
  }

  _extractCompletionContent(parsed) {
    const choice = parsed.choices?.[0];
    if (!choice?.message?.content) {
      throw this.wrapError('chatCompletion', new Error('No content in OpenAI response'));
    }

    return choice.message.content;
  }

  _formatCompletionResult(parsed) {
    return {
      content: this._extractCompletionContent(parsed),
      provider: this.getProviderName(),
      model: parsed.model || this.model,
      usage: this._extractUsage(parsed.usage),
    };
  }

  _wrapChatCompletionError(error) {
    if (error.provider === this.getProviderName()) {
      return error;
    }

    return this.wrapError('chatCompletion', error);
  }

  /**
   * Execute chat completion via OpenAI SDK
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('../contracts').ChatCompletionResult>}
   */
  async chatCompletion(messages, options = {}) {
    const client = this._requireClient();
    const requestParams = this._buildRequestParams(messages, options);
    const requestOptions = this._buildRequestOptions(options);

    try {
      const response = await client.chat.completions.create(requestParams, requestOptions);
      const parsed = parseOpenAiResponse(response);
      return this._formatCompletionResult(parsed);
    } catch (error) {
      throw this._wrapChatCompletionError(error);
    }
  }
}

module.exports = { OpenAIAdapter };
