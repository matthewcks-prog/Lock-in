/**
 * LLM Provider Factory
 *
 * Creates configured provider chains for chat completions.
 * Entry point for all LLM operations.
 *
 * Usage:
 *   const { createChatProviderChain } = require('./providers/llm');
 *   const chain = createChatProviderChain();
 *   const result = await chain.chatCompletion(messages, options);
 *
 * Fallback Chain: Gemini → Groq → OpenAI
 *
 * @module providers/llm/factory
 */

const {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_UPGRADED_MODEL,
  GEMINI_PREMIUM_MODEL,
  GROQ_API_KEY,
  GROQ_MODEL,
  GROQ_FALLBACK_MODEL,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  LLM_CIRCUIT_REDIS_URL,
  LLM_CIRCUIT_REDIS_PREFIX,
  LLM_CIRCUIT_REDIS_ENABLED,
} = require('../../config');
const { GeminiAdapter, GroqAdapter, OpenAIAdapter } = require('./adapters');
const { ProviderChain } = require('./providerChain');
const { createRedisCircuitBreakerStore } = require('../../utils/circuitBreakerStore');

// Singleton cache for provider chain
let cachedChain = null;
let cachedCircuitStore = null;

function getCircuitBreakerStore() {
  if (!LLM_CIRCUIT_REDIS_ENABLED || !LLM_CIRCUIT_REDIS_URL) {
    return null;
  }
  if (!cachedCircuitStore) {
    cachedCircuitStore = createRedisCircuitBreakerStore({
      url: LLM_CIRCUIT_REDIS_URL,
      keyPrefix: LLM_CIRCUIT_REDIS_PREFIX,
    });
  }
  return cachedCircuitStore;
}

/**
 * Create a chat completion provider chain
 * Priority order: Gemini (primary) → Groq (secondary) → OpenAI (tertiary)
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceNew=false] - Bypass cache and create new chain
 * @returns {ProviderChain}
 */
function createChatProviderChain(options = {}) {
  if (cachedChain && !options.forceNew) {
    return cachedChain;
  }

  const adapters = [];

  // Primary: Gemini (with model hierarchy)
  if (GEMINI_API_KEY) {
    adapters.push(
      new GeminiAdapter({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        upgradedModel: GEMINI_UPGRADED_MODEL,
        premiumModel: GEMINI_PREMIUM_MODEL,
      }),
    );
  }

  // Secondary: Groq (with model hierarchy)
  if (GROQ_API_KEY) {
    adapters.push(
      new GroqAdapter({
        apiKey: GROQ_API_KEY,
        model: GROQ_MODEL,
        fallbackModel: GROQ_FALLBACK_MODEL,
      }),
    );
  }

  // Tertiary: OpenAI
  if (OPENAI_API_KEY) {
    adapters.push(
      new OpenAIAdapter({
        apiKey: OPENAI_API_KEY,
        model: OPENAI_MODEL,
      }),
    );
  }

  const circuitBreakerStore = getCircuitBreakerStore();
  cachedChain = new ProviderChain(adapters, {
    circuitBreakerOptions: circuitBreakerStore ? { store: circuitBreakerStore } : undefined,
  });
  return cachedChain;
}

/**
 * Get available provider names
 * @returns {string[]}
 */
function getAvailableProviders() {
  const chain = createChatProviderChain();
  return chain.getAvailableProviders();
}

/**
 * Get primary provider name
 * @returns {string}
 */
function getPrimaryProvider() {
  const chain = createChatProviderChain();
  return chain.getPrimaryProvider();
}

/**
 * Reset provider chain cache (useful for testing)
 */
function resetProviderChain() {
  cachedChain = null;
}

module.exports = {
  createChatProviderChain,
  getAvailableProviders,
  getPrimaryProvider,
  resetProviderChain,
};
