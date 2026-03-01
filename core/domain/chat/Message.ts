/**
 * Core Message domain types - platform-agnostic
 * These types represent the fundamental chat message structure
 * independent of UI, API, or storage implementations.
 */

/**
 * Message role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message attachment metadata
 */
export interface MessageAttachment {
  readonly id: string;
  readonly type: 'image' | 'document' | 'text';
  readonly mimeType: string;
  readonly fileName: string;
  readonly fileSize: number;
  readonly url?: string; // Optional: signed URL for access
  readonly extractedText?: string; // For documents/images with OCR
}

/**
 * Core message structure
 */
export interface Message {
  readonly id: string;
  readonly chatId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly attachments?: ReadonlyArray<MessageAttachment>;
  readonly createdAt: Date;
  readonly metadata?: MessageMetadata;
}

/**
 * Optional metadata for messages
 */
export interface MessageMetadata {
  readonly model?: string; // Which LLM generated this (for assistant messages)
  readonly usage?: TokenUsage; // Token consumption stats
  readonly requestId?: string; // For tracing/debugging
  readonly source?: 'highlight' | 'manual'; // How message was initiated
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Conversation/Chat structure
 */
export interface Conversation {
  readonly id: string;
  readonly userId: string;
  readonly title?: string;
  readonly messages: ReadonlyArray<Message>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastMessageAt?: Date;
}

/**
 * Message creation params (what's needed to create a new message)
 */
export interface CreateMessageParams {
  readonly chatId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly attachments?: ReadonlyArray<string>; // Asset IDs
  readonly metadata?: Partial<MessageMetadata>;
}

/**
 * Chat creation params
 */
export interface CreateChatParams {
  readonly userId: string;
  readonly initialMessage?: string;
  readonly title?: string;
}
