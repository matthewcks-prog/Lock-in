/**
 * Chat Module
 *
 * Exports all chat-related functionality.
 */

// Hooks
export {
  useChat,
  useChatMessages,
  useChatHistory,
  useSendMessage,
  useChatInput,
  useChatAttachments,
} from './hooks';

// Provider
export { ChatQueryProvider } from './ChatQueryProvider';

// Types
export type {
  ChatAttachment,
  ChatMessage,
  ChatMessageRole,
  ChatHistoryItem,
  SendMessageParams,
  UseChatOptions,
} from './types';

// Utilities
export {
  isValidUUID,
  coerceChatTitle,
  buildInitialChatTitle,
  relativeTimeLabel,
  FALLBACK_CHAT_TITLE,
} from './types';
