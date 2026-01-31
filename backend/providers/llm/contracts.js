/**
 * LLM Provider Contracts
 *
 * Unified interface definitions for all LLM providers (Gemini, OpenAI, Groq, etc.)
 * These contracts ensure provider adapters are interchangeable.
 *
 * @module providers/llm/contracts
 */

/**
 * Standard chat message format (OpenAI-compatible)
 * @typedef {Object} ChatMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string|Array<{type: string, text?: string, image_url?: Object}>} content
 */

/**
 * Options for chat completion requests
 * @typedef {Object} ChatCompletionOptions
 * @property {number} [temperature=0.7] - Sampling temperature (0-2)
 * @property {number} [maxTokens=1024] - Maximum tokens to generate
 * @property {Object} [responseFormat] - Response format (e.g., { type: 'json_object' })
 * @property {string} [operation] - Operation name for logging
 */

/**
 * Standardized chat completion result
 * @typedef {Object} ChatCompletionResult
 * @property {string} content - Generated text content
 * @property {string} provider - Provider name (e.g., 'gemini', 'openai')
 * @property {string} model - Model used
 * @property {Object} [usage] - Token usage statistics
 * @property {number} [usage.prompt_tokens] - Input tokens
 * @property {number} [usage.completion_tokens] - Output tokens
 * @property {number} [usage.total_tokens] - Total tokens
 */

/**
 * Provider health status
 * @typedef {Object} ProviderHealth
 * @property {boolean} available - Whether provider is configured and reachable
 * @property {string} provider - Provider name
 * @property {string} [error] - Error message if unhealthy
 */

/**
 * Error types that indicate fallback should be attempted
 */
const FALLBACK_ERROR_PATTERNS = [
  'rate limit',
  'rate_limit',
  'ratelimit',
  'quota',
  '429',
  'too many requests',
  'resource exhausted',
  'resource_exhausted',
  'capacity',
  'overloaded',
  'timeout',
  'timed out',
  'econnreset',
  'econnrefused',
  'socket hang up',
  'network error',
  'service unavailable',
  '503',
  '502',
  '500',
];

/**
 * Error types that should NOT trigger fallback (bad request, etc.)
 */
const NO_FALLBACK_ERROR_PATTERNS = [
  'invalid api key',
  'invalid_api_key',
  'authentication failed',
  'content policy',
  'safety',
  'blocked',
  'invalid request',
  // Note: Removed '400', '401', '403' from patterns - check status codes directly
];

/**
 * Determine if an error should trigger fallback to next provider
 * @param {Error} error - The error to evaluate
 * @returns {boolean} - True if fallback should be attempted
 */
function shouldFallback(error) {
  const message = (error?.message || String(error)).toLowerCase();
  const status = error?.status || error?.response?.status;

  // First check HTTP status codes - these are definitive
  if (status === 400 || status === 401 || status === 403) {
    // Bad request, auth errors - don't fallback
    return false;
  }

  if (status === 429 || status >= 500) {
    // Rate limit or server error - always fallback
    return true;
  }

  // Check if it's explicitly a non-fallback error pattern
  for (const pattern of NO_FALLBACK_ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return false;
    }
  }

  // Check if it matches fallback patterns
  for (const pattern of FALLBACK_ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  // Default: don't fallback for unknown errors (might be invalid request)
  return false;
}

/**
 * Create a standardized provider error
 * @param {string} provider - Provider name
 * @param {string} operation - Operation that failed
 * @param {Error} originalError - Original error
 * @returns {Error} - Standardized error with metadata
 */
function createProviderError(provider, operation, originalError) {
  const error = new Error(`[${provider}] ${operation} failed: ${originalError.message}`);
  error.provider = provider;
  error.operation = operation;
  error.originalError = originalError;
  error.status = originalError?.status || originalError?.response?.status;
  error.shouldFallback = shouldFallback(originalError);
  return error;
}

/**
 * Parse Retry-After from error response
 * Supports HTTP header formats: seconds (integer) or HTTP-date
 * Also parses common error message patterns
 *
 * @param {Error} error - Error with headers or message
 * @returns {number|null} - Seconds to wait, or null if not found
 */
function parseRetryAfter(error) {
  // Check Retry-After header (HTTP standard)
  const header =
    error.headers?.get?.('Retry-After') ||
    error.headers?.['retry-after'] ||
    error.response?.headers?.['retry-after'];

  if (header) {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds) && seconds > 0) return seconds;

    // Handle HTTP-date format (RFC 7231)
    const date = Date.parse(header);
    if (!isNaN(date)) {
      const waitSeconds = Math.ceil((date - Date.now()) / 1000);
      return waitSeconds > 0 ? waitSeconds : null;
    }
  }

  // Check error message for common patterns
  const message = error?.message || '';

  // Pattern: "retry after 30 seconds" or "retry in 30s"
  const retryMatch = message.match(/retry\s+(?:after\s+|in\s+)?(\d+)\s*s(?:econds?)?/i);
  if (retryMatch) {
    return parseInt(retryMatch[1], 10);
  }

  // Pattern: "wait 30 seconds" or "wait 30s"
  const waitMatch = message.match(/wait\s+(\d+)\s*s(?:econds?)?/i);
  if (waitMatch) {
    return parseInt(waitMatch[1], 10);
  }

  // Gemini pattern: "Retry after X"
  const geminiMatch = message.match(/Retry after (\d+)/i);
  if (geminiMatch) {
    return parseInt(geminiMatch[1], 10);
  }

  return null;
}

module.exports = {
  FALLBACK_ERROR_PATTERNS,
  NO_FALLBACK_ERROR_PATTERNS,
  shouldFallback,
  createProviderError,
  parseRetryAfter,
};
