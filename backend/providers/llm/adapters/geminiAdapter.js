/**
 * Gemini Adapter
 *
 * Adapter for Google's Gemini API using REST (no SDK dependency).
 * Primary provider for chat completions.
 *
 * @module providers/llm/adapters/geminiAdapter
 */

const { BaseAdapter } = require('./baseAdapter');
const { parseGeminiResponse } = require('../responseSchemas');
const {
  createGeminiStreamAbortContext,
  fetchGeminiStreamResponse,
  parseGeminiSSEStream,
  parseGeminiSSEEvent,
  createGeminiStreamErrorChunk,
} = require('./geminiStreamHelpers');
const {
  DEFAULT_MODEL,
  UPGRADED_MODEL,
  PREMIUM_MODEL,
  BASE_URL,
  REQUEST_TIMEOUT_MS,
} = require('./gemini/constants');
const {
  convertMessages,
  convertMessageParts,
  toInlineData,
} = require('./gemini/messageConversion');
const {
  selectModel,
  needsUpgradedModel,
  getLastUserMessageContent,
} = require('./gemini/modelSelection');
const {
  buildRequestBody,
  parseErrorDetails,
  buildHttpError,
  executeRequest,
  extractContent,
  extractUsage,
} = require('./gemini/requestHelpers');
const { createGeminiStreamState } = require('./gemini/streamState');

class GeminiAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this._name = 'gemini';
    this.model = config.model || DEFAULT_MODEL;
    this.upgradedModel = config.upgradedModel || UPGRADED_MODEL;
    this.premiumModel = config.premiumModel || PREMIUM_MODEL;
    this.baseUrl = BASE_URL;
  }

  _convertMessages(messages) {
    return convertMessages(messages);
  }

  _convertMessageParts(content) {
    return convertMessageParts(content);
  }

  _toInlineData(url) {
    return toInlineData(url);
  }

  _selectModel(messages, options) {
    return selectModel(messages, options, {
      default: this.model,
      upgraded: this.upgradedModel,
      premium: this.premiumModel,
    });
  }

  _needsUpgradedModel(userMessage, options) {
    return needsUpgradedModel(userMessage, options);
  }

  _getLastUserMessageContent(messages) {
    return getLastUserMessageContent(messages);
  }

  _buildRequestBody(systemInstruction, contents, options) {
    return buildRequestBody(systemInstruction, contents, options);
  }

  _parseErrorDetails(errorBody) {
    return parseErrorDetails(errorBody);
  }

  async _buildHttpError(response) {
    return buildHttpError(response, (error) => this.wrapError('chatCompletion', error));
  }

  async _executeRequest(url, requestBody, requestOptions = {}) {
    const response = await executeRequest(url, requestBody, requestOptions, this.config.apiKey);
    if (!response.ok) {
      throw await this._buildHttpError(response);
    }
    return response.json();
  }

  _extractContent(data) {
    return extractContent(data, (error) => this.wrapError('chatCompletion', error));
  }

  _extractUsage(data) {
    return extractUsage(data);
  }

  _wrapChatCompletionError(error) {
    if (error.provider === this.getProviderName()) {
      return error;
    }
    return this.wrapError('chatCompletion', error);
  }

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
    return createGeminiStreamState();
  }

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

  _parseSSEEvent(event) {
    return parseGeminiSSEEvent(event);
  }
}

module.exports = { GeminiAdapter };
