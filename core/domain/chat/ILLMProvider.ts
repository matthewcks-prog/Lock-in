/**
 * LLM Provider abstraction interface
 * Defines the contract that all LLM adapters must implement
 * Platform-agnostic - belongs in /core domain layer
 */

import type { StreamEvent } from './StreamEvent.js';
import type { Message } from './Message.js';

/**
 * Options for LLM completion requests
 */
export interface CompletionOptions {
  readonly model?: string; // Model identifier
  readonly temperature?: number; // 0.0 to 2.0, controls randomness
  readonly maxTokens?: number; // Maximum tokens to generate
  readonly topP?: number; // Nucleus sampling parameter
  readonly stop?: ReadonlyArray<string>; // Stop sequences
  readonly signal?: AbortSignal; // For cancellation
  readonly timeout?: number; // Request timeout in ms
  readonly user?: string; // User identifier for tracking
}

/**
 * Non-streaming completion response
 */
export interface CompletionResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly lastError?: string;
  readonly lastChecked: Date;
}

/**
 * Base interface that all LLM providers must implement
 */
export interface ILLMProvider {
  /**
   * Provider name/identifier
   */
  readonly name: string;

  /**
   * Generate a completion (blocking/non-streaming)
   * @param messages - Conversation history
   * @param options - Generation options
   * @returns Complete response
   */
  createCompletion(
    messages: ReadonlyArray<Message>,
    options?: CompletionOptions,
  ): Promise<CompletionResponse>;

  /**
   * Generate a completion with streaming (SSE-style)
   * @param messages - Conversation history
   * @param options - Generation options
   * @returns Async generator yielding stream events
   */
  createCompletionStream(
    messages: ReadonlyArray<Message>,
    options?: CompletionOptions,
  ): AsyncGenerator<StreamEvent, void, unknown>;

  /**
   * Check provider health/availability
   * Optional - providers can implement basic health checks
   */
  checkHealth?(): Promise<ProviderHealth>;

  /**
   * Get default model for this provider
   */
  getDefaultModel(): string;

  /**
   * Get supported models
   * Optional - not all providers need to expose this
   */
  getSupportedModels?(): ReadonlyArray<string>;
}

/**
 * Provider with additional capabilities (e.g., function calling, vision)
 */
export interface IAdvancedLLMProvider extends ILLMProvider {
  /**
   * Supports function/tool calling
   */
  readonly supportsFunctionCalling: boolean;

  /**
   * Supports vision/image inputs
   */
  readonly supportsVision: boolean;

  /**
   * Supports JSON mode (structured outputs)
   */
  readonly supportsJSONMode: boolean;
}

/**
 * Provider factory function signature
 * Used by provider chain to instantiate providers
 */
export type ProviderFactory = (config?: Record<string, unknown>) => ILLMProvider;

/**
 * Type guard to check if provider supports advanced features
 */
export function isAdvancedProvider(provider: ILLMProvider): provider is IAdvancedLLMProvider {
  return (
    'supportsFunctionCalling' in provider ||
    'supportsVision' in provider ||
    'supportsJSONMode' in provider
  );
}
