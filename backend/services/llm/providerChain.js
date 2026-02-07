const { createChatProviderChain } = require('../../providers/llm');

// Provider chain singleton
let providerChain = null;

/**
 * Get or create the provider chain
 * @returns {import('../../providers/llm').ProviderChain}
 */
function getProviderChain() {
  if (!providerChain) {
    providerChain = createChatProviderChain();
  }
  return providerChain;
}

/**
 * Execute chat completion via provider chain
 * @param {Object} options
 * @param {Array} options.messages - Chat messages
 * @param {number} [options.temperature] - Sampling temperature
 * @param {number} [options.maxTokens] - Max tokens
 * @param {Object} [options.responseFormat] - Response format
 * @param {string} [options.operation] - Operation name for logging
 * @returns {Promise<Object>}
 */
async function createChatCompletion(options) {
  const chain = getProviderChain();

  const result = await chain.chatCompletion(options.messages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    responseFormat: options.responseFormat,
    operation: options.operation || 'chat.completions.create',
  });

  // Return in legacy format for backward compatibility
  return {
    choices: [{ message: { role: 'assistant', content: result.content } }],
    usage: result.usage,
    model: result.model,
    provider: result.provider,
  };
}

/**
 * Execute streaming chat completion via provider chain
 * @param {Array} messages - Chat messages
 * @param {Object} [options] - Stream options
 * @param {number} [options.temperature] - Sampling temperature
 * @param {number} [options.maxTokens] - Max tokens
 * @param {string} [options.operation] - Operation name for logging
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {AsyncGenerator}
 */
async function* chatCompletionStream(messages, options = {}) {
  const chain = getProviderChain();

  const streamOptions = {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    operation: options.operation || 'chat.completions.stream',
    signal: options.signal,
  };

  yield* chain.chatCompletionStream(messages, streamOptions);
}

module.exports = {
  getProviderChain,
  createChatCompletion,
  chatCompletionStream,
};
