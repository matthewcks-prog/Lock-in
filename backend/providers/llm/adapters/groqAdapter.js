/**
 * Groq Adapter
 *
 * Adapter for Groq's OpenAI-compatible API.
 * Secondary fallback provider with fast inference.
 *
 * Model Routing:
 * - Default: llama-3.1-8b-instant (fast, high capacity)
 * - Fallback: llama-3.3-70b-versatile (higher quality)
 *
 * @module providers/llm/adapters/groqAdapter
 */

const { BaseAdapter } = require('./baseAdapter');
const { fetchWithRetry } = require('../../../utils/networkRetry');
const { parseGroqResponse } = require('../responseSchemas');
const { resolveTimeoutMs } = require('../requestBudget');

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const FALLBACK_MODEL = 'llama-3.3-70b-versatile';
const BASE_URL = 'https://api.groq.com/openai/v1';
const REQUEST_TIMEOUT_MS = 60000;

/**
 * Groq API adapter (OpenAI-compatible)
 * @extends BaseAdapter
 */
class GroqAdapter extends BaseAdapter {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Groq API key
   * @param {string} [config.model] - Primary model (default: llama-3.1-8b-instant)
   * @param {string} [config.fallbackModel] - Fallback model for complex tasks
   */
  constructor(config) {
    super(config);
    this._name = 'groq';
    this.model = config.model || DEFAULT_MODEL;
    this.fallbackModel = config.fallbackModel || FALLBACK_MODEL;
    this.baseUrl = BASE_URL;
  }

  _buildRequestBody(model, messages, options) {
    const requestBody = {
      model,
      messages: this._formatMessages(messages),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    };

    if (options.responseFormat?.type === 'json_object') {
      requestBody.response_format = { type: 'json_object' };
    }

    return requestBody;
  }

  _parseErrorDetails(errorBody) {
    if (!errorBody) return '';
    try {
      const parsed = JSON.parse(errorBody);
      return parsed.error?.message || errorBody.substring(0, 200);
    } catch {
      return errorBody.substring(0, 200);
    }
  }

  async _buildHttpError(response) {
    const errorBody = await response.text();
    const errorDetails = this._parseErrorDetails(errorBody);
    const error = new Error(`Groq API error: ${response.status} - ${errorDetails}`);
    error.status = response.status;
    return this.wrapError('chatCompletion', error);
  }

  async _executeRequest(url, requestBody, requestOptions = {}) {
    const timeoutMs = resolveTimeoutMs(requestOptions.timeoutMs, REQUEST_TIMEOUT_MS);
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: requestOptions.signal,
      },
      {
        maxRetries: 0,
        timeoutMs,
        context: 'groq chatCompletion',
      },
    );

    if (!response.ok) {
      throw await this._buildHttpError(response);
    }

    return await response.json();
  }

  _extractContent(data) {
    const choice = data.choices?.[0];
    if (!choice?.message?.content) {
      throw this.wrapError('chatCompletion', new Error('No content in Groq response'));
    }
    return choice.message.content;
  }

  _extractUsage(data) {
    if (!data.usage) {
      return null;
    }
    return {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
    };
  }

  _wrapChatCompletionError(error) {
    if (error.provider === this.getProviderName()) {
      return error;
    }
    return this.wrapError('chatCompletion', error);
  }

  /**
   * Execute chat completion via Groq's OpenAI-compatible API
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('../contracts').ChatCompletionResult>}
   */
  async chatCompletion(messages, options = {}) {
    const model = this._selectModel(messages, options);
    const requestBody = this._buildRequestBody(model, messages, options);
    const url = `${this.baseUrl}/chat/completions`;

    try {
      const data = await this._executeRequest(url, requestBody, {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      });
      const parsed = parseGroqResponse(data);
      const content = this._extractContent(parsed);
      const usage = this._extractUsage(parsed);

      return {
        content,
        provider: this.getProviderName(),
        model: parsed.model || model,
        usage,
      };
    } catch (error) {
      throw this._wrapChatCompletionError(error);
    }
  }

  /**
   * Select appropriate model based on task complexity
   * @private
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} options
   * @returns {string} Selected model name
   */
  _selectModel(messages, options) {
    // Use fallback model if explicitly requested
    if (options.useHigherQualityModel) {
      return this.fallbackModel;
    }

    // Check for complex task indicators
    const lastUserMessage = this._getLastUserMessageContent(messages);

    if (this._isComplexTask(lastUserMessage, options)) {
      return this.fallbackModel;
    }

    return this.model;
  }

  /**
   * Check if task requires higher quality model
   * @private
   */
  _isComplexTask(userMessage, options) {
    if (!userMessage) return false;

    const lowerMessage = userMessage.toLowerCase();

    // Complexity indicators
    const complexPatterns = [
      'step-by-step',
      'step by step',
      'detailed',
      'explain in depth',
      'comprehensive',
      'analyze',
      'compare and contrast',
    ];

    // Long input threshold (likely lecture chunk)
    const isLongInput = userMessage.length > 3000;

    // Check for structured output requirements
    const needsStructuredOutput =
      options.responseFormat?.type === 'json_object' || lowerMessage.includes('table');

    return (
      isLongInput ||
      needsStructuredOutput ||
      complexPatterns.some((pattern) => lowerMessage.includes(pattern))
    );
  }

  /**
   * Get the last user message content
   * @private
   */
  _getLastUserMessageContent(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const content = messages[i].content;
        return typeof content === 'string' ? content : content?.[0]?.text || '';
      }
    }
    return '';
  }

  /**
   * Format messages for Groq API (OpenAI-compatible)
   * @private
   * @param {import('../contracts').ChatMessage[]} messages
   * @returns {Array} Formatted messages
   */
  _formatMessages(messages) {
    return messages.map((msg) => {
      // Handle multimodal content (Groq supports images via URL)
      if (Array.isArray(msg.content)) {
        return {
          role: msg.role,
          content: msg.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            }
            if (part.type === 'image_url') {
              return { type: 'image_url', image_url: part.image_url };
            }
            return { type: 'text', text: '[unsupported content]' };
          }),
        };
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }
}

module.exports = { GroqAdapter };
