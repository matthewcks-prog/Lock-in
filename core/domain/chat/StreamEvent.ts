/**
 * Standardized streaming event protocol for chat responses
 * These events flow from LLM provider → backend → UI
 */

import type { TokenUsage } from './Message.js';

/**
 * Base event structure - all events extend this
 */
export interface BaseStreamEvent {
  readonly type: string;
  readonly timestamp?: number; // Unix timestamp ms
}

/**
 * Stream has started - contains metadata about the response
 */
export interface StreamStartEvent extends BaseStreamEvent {
  readonly type: 'stream_start';
  readonly chatId: string;
  readonly messageId: string;
  readonly requestId: string;
  readonly model: string;
}

/**
 * Content delta - incremental text chunk
 */
export interface StreamDeltaEvent extends BaseStreamEvent {
  readonly type: 'stream_delta';
  readonly messageId: string;
  readonly delta: string; // Text chunk to append
  readonly index?: number; // Optional: chunk sequence number
}

/**
 * Stream has completed successfully
 */
export interface StreamEndEvent extends BaseStreamEvent {
  readonly type: 'stream_end';
  readonly messageId: string;
  readonly content: string; // Complete content (redundant but useful for validation)
  readonly usage?: TokenUsage;
  readonly finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

/**
 * Stream encountered an error
 */
export interface StreamErrorEvent extends BaseStreamEvent {
  readonly type: 'stream_error';
  readonly messageId?: string;
  readonly code: StreamErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly provider?: string; // Which provider failed
}

/**
 * Recoverable error during stream - allows continuation
 */
export interface StreamRecoveryEvent extends BaseStreamEvent {
  readonly type: 'stream_recovery';
  readonly messageId: string;
  readonly message: string;
  readonly fallbackProvider?: string; // If switching providers
}

/**
 * Heartbeat to keep connection alive
 */
export interface StreamHeartbeatEvent extends BaseStreamEvent {
  readonly type: 'stream_heartbeat';
}

/**
 * Stream explicitly done (final event)
 */
export interface StreamDoneEvent extends BaseStreamEvent {
  readonly type: 'stream_done';
}

/**
 * Union type of all stream events
 */
export type StreamEvent =
  | StreamStartEvent
  | StreamDeltaEvent
  | StreamEndEvent
  | StreamErrorEvent
  | StreamRecoveryEvent
  | StreamHeartbeatEvent
  | StreamDoneEvent;

/**
 * Stream error classification
 */
export type StreamErrorCode =
  | 'rate_limit' // 429 - too many requests
  | 'timeout' // Request timed out
  | 'network_error' // Connection failed
  | 'server_error' // Provider 5xx error
  | 'client_error' // Bad request (4xx except 429)
  | 'aborted' // User cancelled
  | 'content_filter' // Content policy violation
  | 'token_limit' // Max tokens exceeded
  | 'provider_error' // Provider-specific error
  | 'unknown'; // Unclassified error

/**
 * Type guard to check if event is an error
 */
export function isStreamError(event: StreamEvent): event is StreamErrorEvent {
  return event.type === 'stream_error';
}

/**
 * Type guard to check if event contains content
 */
export function hasContent(event: StreamEvent): event is StreamDeltaEvent | StreamEndEvent {
  return event.type === 'stream_delta' || event.type === 'stream_end';
}

/**
 * Extract content from event if it has any
 */
export function extractContent(event: StreamEvent): string | null {
  if (event.type === 'stream_delta') {
    return event.delta;
  }
  if (event.type === 'stream_end') {
    return event.content;
  }
  return null;
}
