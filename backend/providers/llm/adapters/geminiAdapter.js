/**
 * Gemini Adapter
 *
 * Adapter for Google's Gemini API using REST (no SDK dependency).
 * Primary provider for chat completions.
 *
 * Model Routing:
 * - Default: gemini-2.0-flash (fast, cheap)
 * - Upgraded: gemini-2.5-flash (better for complex/long inputs)
 * - Premium: gemini-2.5-pro (critical correctness)
 *
 * @module providers/llm/adapters/geminiAdapter
 */

const { BaseAdapter } = require('./baseAdapter');
const { fetchWithRetry } = require('../../../utils/networkRetry');
const { parseGeminiResponse } = require('../responseSchemas');
const { createFinalChunk } = require('../contracts');
const {
  createGeminiStreamAbortContext,
  fetchGeminiStreamResponse,
  parseGeminiSSEStream,
  parseGeminiSSEEvent,
  createGeminiStreamErrorChunk,
} = require('./geminiStreamHelpers');

const DEFAULT_MODEL = 'gemini-2.0-flash';
const UPGRADED_MODEL = 'gemini-2.5-flash';
const PREMIUM_MODEL = 'gemini-2.5-pro';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 60000;
const LONG_INPUT_THRESHOLD = 3000;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const ERROR_DETAILS_MAX_LENGTH = 200;

/**
 * Gemini API adapter
 * @extends BaseAdapter
 */
class GeminiAdapter extends BaseAdapter {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Gemini API key
   * @param {string} [config.model] - Default model (default: gemini-2.0-flash)
   * @param {string} [config.upgradedModel] - Model for complex tasks
   * @param {string} [config.premiumModel] - Model for critical correctness
   */
  constructor(config) {
    super(config);
    this._name = 'gemini';
    this.model = config.model || DEFAULT_MODEL;
    this.upgradedModel = config.upgradedModel || UPGRADED_MODEL;
    this.premiumModel = config.premiumModel || PREMIUM_MODEL;
    this.baseUrl = BASE_URL;
  }

  /**
   * Convert OpenAI-style messages to Gemini format
   * @private
   * @param {import('../contracts').ChatMessage[]} messages
   * @returns {{ systemInstruction: Object|null, contents: Array }}
   */
  _convertMessages(messages) {
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts = this._convertMessageParts(msg.content);
      contents.push({ role, parts });
    }

    return { systemInstruction, contents };
  }

  _convertMessageParts(content) {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    if (Array.isArray(content)) {
      return content.map((part) => {
        if (part.type === 'text') {
          return { text: part.text };
        }

        if (part.type === 'image_url' && part.image_url?.url) {
          const inlineData = this._toInlineData(part.image_url.url);
          if (inlineData) {
            return { inline_data: inlineData };
          }
        }

        return { text: '[unsupported content]' };
      });
    }

    return [{ text: String(content) }];
  }

  _toInlineData(url) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return null;
    }

    return {
      mime_type: match[1],
      data: match[2],
    };
  }

  /**
   * Select appropriate model based on task complexity
   * @private
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} options
   * @returns {string} Selected model name
   */
  _selectModel(messages, options) {
    if (options.usePremiumModel) {
      return this.premiumModel;
    }

    if (options.useUpgradedModel) {
      return this.upgradedModel;
    }

    const lastUserMessage = this._getLastUserMessageContent(messages);
    return this._needsUpgradedModel(lastUserMessage, options) ? this.upgradedModel : this.model;
  }

  /**
   * Check if task requires upgraded model
   * @private
   */
  _needsUpgradedModel(userMessage, options) {
    if (!userMessage) {
      return false;
    }

    const lowerMessage = userMessage.toLowerCase();
    const upgradePatterns = [
      'step-by-step',
      'step by step',
      'detailed',
      'explain in depth',
      'comprehensive',
    ];

    const isLongInput = userMessage.length > LONG_INPUT_THRESHOLD;
    const needsStructuredOutput =
      options.responseFormat?.type === 'json_object' ||
      lowerMessage.includes('table') ||
      lowerMessage.includes('json');

    return (
      isLongInput ||
      needsStructuredOutput ||
      upgradePatterns.some((pattern) => lowerMessage.includes(pattern))
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

  _buildRequestBody(systemInstruction, contents, options) {
    const requestBody = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    if (options.responseFormat?.type === 'json_object') {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    return requestBody;
  }

  _parseErrorDetails(errorBody) {
    if (!errorBody) {
      return '';
    }

    try {
      const parsed = JSON.parse(errorBody);
      return parsed.error?.message || errorBody.substring(0, ERROR_DETAILS_MAX_LENGTH);
    } catch {
      return errorBody.substring(0, ERROR_DETAILS_MAX_LENGTH);
    }
  }

  async _buildHttpError(response) {
    const errorBody = await response.text();
    const errorDetails = this._parseErrorDetails(errorBody);
    const error = new Error(`Gemini API error: ${response.status} - ${errorDetails}`);
    error.status = response.status;
    return this.wrapError('chatCompletion', error);
  }

  async _executeRequest(url, requestBody, requestOptions = {}) {
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: requestOptions.signal,
      },
      {
        maxRetries: 0,
        timeoutMs: requestOptions.timeoutMs ?? REQUEST_TIMEOUT_MS,
        context: 'gemini chatCompletion',
      },
    );

    if (!response.ok) {
      throw await this._buildHttpError(response);
    }

    return await response.json();
  }

  _extractContent(data) {
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      throw this.wrapError('chatCompletion', new Error('No content in Gemini response'));
    }
    return candidate.content.parts[0].text;
  }

  _extractUsage(data) {
    if (!data.usageMetadata) {
      return null;
    }

    return {
      prompt_tokens: data.usageMetadata.promptTokenCount || 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata.totalTokenCount || 0,
    };
  }

  _wrapChatCompletionError(error) {
    if (error.provider === this.getProviderName()) {
      return error;
    }
    return this.wrapError('chatCompletion', error);
  }

  /**
   * Execute chat completion via Gemini REST API
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('../contracts').ChatCompletionResult>}
   */
  async chatCompletion(messages, options = {}) {
    const { systemInstruction, contents } = this._convertMessages(messages);
    const selectedModel = this._selectModel(messages, options);
    const requestBody = this._buildRequestBody(systemInstruction, contents, options);
    const url = `${this.baseUrl}/models/${selectedModel}:generateContent`;

    try {
      const data = await this._executeRequest(url, requestBody, {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      });
      const parsed = parseGeminiResponse(data);

      return {
        content: this._extractContent(parsed),
        provider: this.getProviderName(),
        model: selectedModel,
        usage: this._extractUsage(parsed),
      };
    } catch (error) {
      throw this._wrapChatCompletionError(error);
    }
  }

  /**
   * Check if this adapter supports native streaming
   * @returns {boolean}
   */
  supportsStreaming() {
    return true;
  }

  _buildStreamRequest(messages, options) {
    const { systemInstruction, contents } = this._convertMessages(messages);
    const selectedModel = this._selectModel(messages, options);
    return {
      requestBody: this._buildRequestBody(systemInstruction, contents, options),
      url: `${this.baseUrl}/models/${selectedModel}:streamGenerateContent?alt=sse`,
    };
  }

  async _createStreamResponse(streamRequest, options) {
    const abortContext = createGeminiStreamAbortContext({
      timeoutMs: options.timeoutMs,
      fallbackTimeoutMs: REQUEST_TIMEOUT_MS,
      signal: options.signal,
    });

    try {
      const response = await fetchGeminiStreamResponse({
        url: streamRequest.url,
        apiKey: this.config.apiKey,
        requestBody: streamRequest.requestBody,
        signal: abortContext.signal,
      });
      return { response, abortContext };
    } catch (error) {
      abortContext.cleanup();
      throw error;
    }
  }

  _createStreamState() {
    let accumulatedContent = '';
    let usage = null;

    return {
      onChunk(chunk) {
        if (chunk.content) {
          accumulatedContent += chunk.content;
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      },
      getFinalChunk() {
        return createFinalChunk(accumulatedContent, usage);
      },
    };
  }

  /**
   * Execute streaming chat completion via Gemini REST API
   * Uses streamGenerateContent endpoint with SSE format.
   *
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {AsyncGenerator<import('../contracts').ProviderStreamChunk>}
   */
  async *chatCompletionStream(messages, options = {}) {
    const streamRequest = this._buildStreamRequest(messages, options);

    let streamResponse;
    try {
      streamResponse = await this._createStreamResponse(streamRequest, options);
    } catch (error) {
      throw this._wrapChatCompletionError(error);
    }

    if (!streamResponse.response.ok) {
      streamResponse.abortContext.cleanup();
      throw await this._buildHttpError(streamResponse.response);
    }

    const streamState = this._createStreamState();

    try {
      yield* parseGeminiSSEStream(streamResponse.response.body, streamState.onChunk);
      yield streamState.getFinalChunk();
    } catch (error) {
      yield createGeminiStreamErrorChunk(error);
      throw this._wrapChatCompletionError(error);
    } finally {
      streamResponse.abortContext.cleanup();
    }
  }

  /**
   * Parse a single SSE event into a stream chunk
   * @private
   * @param {string} event - Raw SSE event text
   * @returns {import('../contracts').ProviderStreamChunk|null}
   */
  _parseSSEEvent(event) {
    return parseGeminiSSEEvent(event);
  }
}

module.exports = { GeminiAdapter };
