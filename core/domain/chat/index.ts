/**
 * Core chat domain exports
 * Platform-agnostic types, errors, and utilities
 */

// Types
export type {
  Message,
  MessageRole,
  MessageAttachment,
  MessageMetadata,
  TokenUsage,
  Conversation,
  CreateMessageParams,
  CreateChatParams,
} from './Message.js';

export type {
  StreamEvent,
  StreamStartEvent,
  StreamDeltaEvent,
  StreamEndEvent,
  StreamErrorEvent,
  StreamRecoveryEvent,
  StreamHeartbeatEvent,
  StreamDoneEvent,
  StreamErrorCode,
} from './StreamEvent.js';

export { isStreamError, hasContent, extractContent } from './StreamEvent.js';

// Validation
export type { MessageValidationConfig } from './messageValidation.js';
export {
  DEFAULT_MESSAGE_VALIDATION,
  validateRole,
  validateContentLength,
  validateAttachmentCount,
  sanitizeContent,
  validateCreateMessageParams,
  isUserMessage,
  isAssistantMessage,
  hasAttachments,
  getFullTextContent,
  estimateTokens,
  wouldExceedTokenLimit,
} from './messageValidation.js';

// Token limits
export type { ModelTokenLimits } from './tokenLimits.js';
export {
  MODEL_TOKEN_LIMITS,
  getModelTokenLimits,
  calculateAvailablePromptTokens,
  exceedsContextWindow,
  getRecommendedOutputTokens,
} from './tokenLimits.js';

// Serialization
export {
  serializeMessage,
  deserializeMessage,
  serializeAttachment,
  deserializeAttachment,
  serializeConversation,
  toProviderMessage,
  toProviderMessages,
  extractConversationHistory,
  formatForDisplay,
} from './messageSerializer.js';

// Provider Interface
export type {
  ILLMProvider,
  IAdvancedLLMProvider,
  CompletionOptions,
  CompletionResponse,
  ProviderHealth,
  ProviderFactory,
} from './ILLMProvider.js';
export { isAdvancedProvider } from './ILLMProvider.js';
