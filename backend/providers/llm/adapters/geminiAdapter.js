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

  /**
   * Execute chat completion via Gemini REST API
   * @param {import('../contracts').ChatMessage[]} messages
   * @param {import('../contracts').ChatCompletionOptions} [options]
   * @returns {Promise<import('../contracts').ChatCompletionResult>}
   */
  async chatCompletion(messages, options = {}) {
    const { systemInstruction, contents } = this._convertMessages(messages);
    const selectedModel = this._selectModel(messages, options);

    const requestBody = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
      },
    };

    // Add system instruction if present
    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    // Add JSON mode if requested
    if (options.responseFormat?.type === 'json_object') {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const url = `${this.baseUrl}/models/${selectedModel}:generateContent`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorDetails = '';
        try {
          const parsed = JSON.parse(errorBody);
          errorDetails = parsed.error?.message || errorBody.substring(0, 200);
        } catch {
          errorDetails = errorBody.substring(0, 200);
        }
        const error = new Error(`Gemini API error: ${response.status} - ${errorDetails}`);
        error.status = response.status;
        throw this.wrapError('chatCompletion', error);
      }

      const data = await response.json();

      // Extract response content
      const candidate = data.candidates?.[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        throw this.wrapError('chatCompletion', new Error('No content in Gemini response'));
      }

      const content = candidate.content.parts[0].text;

      // Build usage stats (Gemini includes these)
      const usage = data.usageMetadata
        ? {
            prompt_tokens: data.usageMetadata.promptTokenCount || 0,
            completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
            total_tokens: data.usageMetadata.totalTokenCount || 0,
          }
        : null;

      return {
        content,
        provider: this.getProviderName(),
        model: selectedModel,
        usage,
      };
    } catch (error) {
      if (error.provider === this.getProviderName()) {
        throw error; // Already wrapped
      }

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        throw this.wrapError('chatCompletion', new Error('Request timed out after 60s'));
      }

      throw this.wrapError('chatCompletion', error);
    }
  }
}

module.exports = { GeminiAdapter };
