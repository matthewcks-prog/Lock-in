/**
 * LLM Provider Module
 *
 * Clean public API for LLM provider access.
 *
 * @module providers/llm
 */

const {
  createChatProviderChain,
  getAvailableProviders,
  getPrimaryProvider,
  resetProviderChain,
} = require('./factory');
const { ProviderChain } = require('./providerChain');
const { GeminiAdapter, GroqAdapter, OpenAIAdapter, BaseAdapter } = require('./adapters');
const {
  shouldFallback,
  createProviderError,
  parseRetryAfter,
  FALLBACK_ERROR_PATTERNS,
  NO_FALLBACK_ERROR_PATTERNS,
} = require('./contracts');
const {
  RateLimiterManager,
  getRateLimiterManager,
  resetRateLimiterManager,
  DEFAULT_LIMITS,
  TOKEN_COSTS,
} = require('./rateLimiter');

module.exports = {
  // Factory functions (primary API)
  createChatProviderChain,
  getAvailableProviders,
  getPrimaryProvider,
  resetProviderChain,

  // Rate limiter
  getRateLimiterManager,
  resetRateLimiterManager,
  RateLimiterManager,
  DEFAULT_LIMITS,
  TOKEN_COSTS,

  // Classes (for testing/extension)
  ProviderChain,
  GeminiAdapter,
  GroqAdapter,
  OpenAIAdapter,
  BaseAdapter,

  // Utilities
  shouldFallback,
  createProviderError,
  parseRetryAfter,
  FALLBACK_ERROR_PATTERNS,
  NO_FALLBACK_ERROR_PATTERNS,
};
