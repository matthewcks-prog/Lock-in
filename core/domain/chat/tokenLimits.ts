/**
 * Token limit policies for different models
 * Pure configuration - no I/O
 */

/**
 * Model-specific token limits
 */
export interface ModelTokenLimits {
  readonly contextWindow: number; // Total tokens model can handle
  readonly maxOutput: number; // Max tokens for completion
  readonly reserveTokens: number; // Tokens to reserve for system/formatting
}

/**
 * Token limit configurations by model family
 */
const DEFAULT_TOKEN_LIMITS: ModelTokenLimits = {
  contextWindow: 8000,
  maxOutput: 2048,
  reserveTokens: 500,
};

export const MODEL_TOKEN_LIMITS: Record<string, ModelTokenLimits> = {
  // Gemini models
  'gemini-2.0-flash': {
    contextWindow: 1000000,
    maxOutput: 8192,
    reserveTokens: 500,
  },
  'gemini-2.5-flash': {
    contextWindow: 1000000,
    maxOutput: 8192,
    reserveTokens: 500,
  },
  'gemini-2.5-pro': {
    contextWindow: 2000000,
    maxOutput: 8192,
    reserveTokens: 500,
  },

  // OpenAI models
  'gpt-4o': {
    contextWindow: 128000,
    maxOutput: 4096,
    reserveTokens: 500,
  },
  'gpt-4o-mini': {
    contextWindow: 128000,
    maxOutput: 16384,
    reserveTokens: 500,
  },
  'gpt-4-turbo': {
    contextWindow: 128000,
    maxOutput: 4096,
    reserveTokens: 500,
  },

  // Groq/Llama models
  'llama-3.3-70b': {
    contextWindow: 128000,
    maxOutput: 8000,
    reserveTokens: 500,
  },

  // Default/fallback
  default: DEFAULT_TOKEN_LIMITS,
};

/**
 * Get token limits for a specific model
 */
export function getModelTokenLimits(model: string): ModelTokenLimits {
  const exactMatch = MODEL_TOKEN_LIMITS[model];
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  // Try prefix match (e.g., "gpt-4o-2024-05-13" -> "gpt-4o")
  const prefix = Object.keys(MODEL_TOKEN_LIMITS).find((key) => model.startsWith(key));
  if (prefix !== undefined) {
    const prefixMatch = MODEL_TOKEN_LIMITS[prefix];
    if (prefixMatch !== undefined) {
      return prefixMatch;
    }
  }

  // Fallback to default
  return DEFAULT_TOKEN_LIMITS;
}

/**
 * Calculate available tokens for prompt given model and desired output length
 */
export function calculateAvailablePromptTokens(
  model: string,
  desiredOutputTokens?: number,
): number {
  const limits = getModelTokenLimits(model);
  const outputTokens = desiredOutputTokens || limits.maxOutput;

  return limits.contextWindow - outputTokens - limits.reserveTokens;
}

/**
 * Check if token count exceeds model's context window
 */
export function exceedsContextWindow(
  model: string,
  promptTokens: number,
  outputTokens: number = 0,
): boolean {
  const limits = getModelTokenLimits(model);
  const totalTokens = promptTokens + outputTokens + limits.reserveTokens;

  return totalTokens > limits.contextWindow;
}

/**
 * Get recommended output tokens for streaming
 * Returns conservative value to avoid hitting limits mid-stream
 */
export function getRecommendedOutputTokens(model: string): number {
  const limits = getModelTokenLimits(model);
  // Use 75% of max output to leave buffer
  return Math.floor(limits.maxOutput * 0.75);
}
