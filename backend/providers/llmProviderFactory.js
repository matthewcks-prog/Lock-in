/**
 * LLM Provider Factory - Chat Completions Only
 *
 * Strategy for Lock-in:
 * - Chat Completions: OpenAI (Primary) - No Azure GPT quota on student accounts
 *
 * Note: Embeddings and transcription use separate factories
 *
 * @module providers/llmProviderFactory
 */

const OpenAI = require('openai');
const { OPENAI_API_KEY } = require('../config');

let cachedPrimaryClient;

function createOpenAIClient() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for chat completions.');
  }

  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

/**
 * Create primary chat completion client (OpenAI only)
 */
function createPrimaryClient() {
  if (cachedPrimaryClient) {
    return cachedPrimaryClient;
  }

  cachedPrimaryClient = { provider: 'openai', client: createOpenAIClient() };
  return cachedPrimaryClient;
}

/**
 * Create fallback client (not needed for Lock-in chat)
 * Kept for backward compatibility but always returns null
 */
function createFallbackClient() {
  // No fallback for chat completions in Lock-in
  return null;
}

module.exports = {
  createPrimaryClient,
  createFallbackClient,
};
