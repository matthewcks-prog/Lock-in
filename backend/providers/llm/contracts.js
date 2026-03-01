/**
 * LLM Provider Contracts
 *
 * Unified interface definitions for all LLM providers (Gemini, OpenAI, Groq, etc.)
 * These contracts ensure provider adapters are interchangeable.
 *
 * @module providers/llm/contracts
 */

const { FALLBACK_ERROR_PATTERNS, NO_FALLBACK_ERROR_PATTERNS } = require('./contracts/patterns');
const { shouldFallback } = require('./contracts/fallbackPolicy');
const { createProviderError } = require('./contracts/providerError');
const { parseRetryAfter } = require('./contracts/retryAfter');
const {
  createDeltaChunk,
  createFinalChunk,
  createStreamErrorChunk,
  createDoneChunk,
  createMetaChunk,
} = require('./contracts/streamChunks');

module.exports = {
  FALLBACK_ERROR_PATTERNS,
  NO_FALLBACK_ERROR_PATTERNS,
  shouldFallback,
  createProviderError,
  parseRetryAfter,
  createDeltaChunk,
  createFinalChunk,
  createStreamErrorChunk,
  createDoneChunk,
  createMetaChunk,
};
