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
const { resolveTimeoutMs } = require('../requestBudget');
const { createDeltaChunk, createFinalChunk, createStreamErrorChunk } = require('../contracts');

const DEFAULT_MODEL = 'gemini-2.0-flash';
const UPGRADED_MODEL = 'gemini-2.5-flash';
const PREMIUM_MODEL = 'gemini-2.5-pro';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 60000;

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
        // Gemini uses systemInstruction separately
        systemInstruction = {
          parts: [{ text: msg.content }],
        };
        continue;
      }

      // Map roles: user → user, assistant → model
      const role = msg.role === 'assistant' ? 'model' : 'user';

      // Handle multimodal content
      let parts;
      if (typeof msg.content === 'string') {
        parts = [{ text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        parts = msg.content.map((part) => {
          if (part.type === 'text') {
            return { text: part.text };
          }
          if (part.type === 'image_url' && part.image_url?.url) {
            // Convert data URL to inline_data
            const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              return {
                inline_data: {
                  mime_type: match[1],
                  data: match[2],
                },
              };
            }
          }
          return { text: '[unsupported content]' };
        });
      } else {
        parts = [{ text: String(msg.content) }];
      }

      contents.push({ role, parts });
    }

    return { systemInstruction, contents };
  }

  /**
   * Select appropriate model based on task complexity
   * @private
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} options
   * @returns {string} Selected model name
   */
  _selectModel(messages, options) {
    // Use premium model if explicitly requested for critical correctness
    if (options.usePremiumModel) {
      return this.premiumModel;
    }

    // Use upgraded model if explicitly requested
    if (options.useUpgradedModel) {
      return this.upgradedModel;
    }

    // Auto-detect need for upgraded model
    const lastUserMessage = this._getLastUserMessageContent(messages);

    if (this._needsUpgradedModel(lastUserMessage, options)) {
      return this.upgradedModel;
    }

    return this.model;
  }

  /**
   * Check if task requires upgraded model
   * @private
   */
  _needsUpgradedModel(userMessage, options) {
    if (!userMessage) return false;

    const lowerMessage = userMessage.toLowerCase();

    // Upgrade indicators (per user requirements)
    const upgradePatterns = [
      'step-by-step',
      'step by step',
      'detailed',
      'explain in depth',
      'comprehensive',
    ];

    // Long input threshold (big lecture chunk)
    const isLongInput = userMessage.length > 3000;

    // Needs structured output (JSON/table)
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
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
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
    const error = new Error(`Gemini API error: ${response.status} - ${errorDetails}`);
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
          'X-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: requestOptions.signal,
      },
      {
        maxRetries: 0,
        timeoutMs,
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
      const content = this._extractContent(parsed);
      const usage = this._extractUsage(parsed);

      return {
        content,
        provider: this.getProviderName(),
        model: selectedModel,
        usage,
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

  /**
   * Execute streaming chat completion via Gemini REST API
   * Uses streamGenerateContent endpoint with SSE format.
   *
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {AsyncGenerator<import('../contracts').ProviderStreamChunk>}
   */
  async *chatCompletionStream(messages, options = {}) {
    const { systemInstruction, contents } = this._convertMessages(messages);
    const selectedModel = this._selectModel(messages, options);
    const requestBody = this._buildRequestBody(systemInstruction, contents, options);
    const url = `${this.baseUrl}/models/${selectedModel}:streamGenerateContent?alt=sse`;

    const timeoutMs = resolveTimeoutMs(options.timeoutMs, REQUEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link external signal if provided
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw this._wrapChatCompletionError(error);
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      throw await this._buildHttpError(response);
    }

    // Stream the response
    let accumulatedContent = '';
    let usage = null;

    try {
      yield* this._parseSSEStream(response.body, (chunk) => {
        if (chunk.content) {
          accumulatedContent += chunk.content;
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      });

      // Yield final chunk with accumulated content
      yield createFinalChunk(accumulatedContent, usage);
    } catch (error) {
      if (error.name === 'AbortError') {
        yield createStreamErrorChunk('ABORTED', 'Request was cancelled', false);
      } else {
        yield createStreamErrorChunk(
          'UPSTREAM_ERROR',
          error.message || 'Stream processing failed',
          true,
        );
      }
      throw this._wrapChatCompletionError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Gemini SSE stream and yield delta chunks
   * @private
   * @param {ReadableStream} body - Response body stream
   * @param {Function} onChunk - Callback to track accumulated state
   * @returns {AsyncGenerator<import('../contracts').ProviderStreamChunk>}
   */
  async *_parseSSEStream(body, onChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const event of events) {
          const chunk = this._parseSSEEvent(event);
          if (chunk) {
            onChunk(chunk);
            if (chunk.type === 'delta') {
              yield chunk;
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const chunk = this._parseSSEEvent(buffer);
        if (chunk) {
          onChunk(chunk);
          if (chunk.type === 'delta') {
            yield chunk;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse a single SSE event into a stream chunk
   * @private
   * @param {string} event - Raw SSE event text
   * @returns {import('../contracts').ProviderStreamChunk|null}
   */
  _parseSSEEvent(event) {
    const lines = event.split('\n');
    let data = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (!data) return null;

    try {
      const parsed = JSON.parse(data);

      // Extract text from Gemini response format
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return createDeltaChunk(text);
      }

      // Extract usage metadata if present (usually in final chunk)
      if (parsed.usageMetadata) {
        return {
          type: 'delta',
          content: '',
          usage: {
            prompt_tokens: parsed.usageMetadata.promptTokenCount || 0,
            completion_tokens: parsed.usageMetadata.candidatesTokenCount || 0,
            total_tokens: parsed.usageMetadata.totalTokenCount || 0,
          },
        };
      }

      return null;
    } catch {
      // Ignore parse errors for malformed events
      return null;
    }
  }
}

module.exports = { GeminiAdapter };
