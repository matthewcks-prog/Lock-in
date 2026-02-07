/**
 * Pure validation functions for message content
 * No I/O, no dependencies - pure domain logic
 */

import { ValidationError } from '../../errors/index.js';
import type { Message, MessageRole, CreateMessageParams } from './Message.js';

/**
 * Configuration for message validation
 */
export interface MessageValidationConfig {
  readonly maxContentLength: number;
  readonly maxAttachments: number;
  readonly maxAttachmentSize: number; // bytes
  readonly allowedMimeTypes: ReadonlyArray<string>;
}

/**
 * Default validation config
 */
export const DEFAULT_MESSAGE_VALIDATION: MessageValidationConfig = {
  maxContentLength: 32000, // ~8k tokens for most models
  maxAttachments: 10,
  maxAttachmentSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
  ],
};

/**
 * Validate message role
 */
export function validateRole(role: string): MessageRole {
  if (role !== 'user' && role !== 'assistant' && role !== 'system') {
    throw new ValidationError(
      `Invalid message role: ${role}. Must be 'user', 'assistant', or 'system'`,
      'role',
      { details: { allowed: ['user', 'assistant', 'system'] } },
    );
  }
  return role as MessageRole;
}

/**
 * Validate message content length
 */
export function validateContentLength(
  content: string,
  config: MessageValidationConfig = DEFAULT_MESSAGE_VALIDATION,
): void {
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Message content cannot be empty', 'content');
  }

  if (content.length > config.maxContentLength) {
    throw new ValidationError(
      `Message content exceeds maximum length of ${config.maxContentLength} characters`,
      'content',
      { details: { actual: content.length, max: config.maxContentLength } },
    );
  }
}

/**
 * Validate attachment count
 */
export function validateAttachmentCount(
  attachments: ReadonlyArray<unknown>,
  config: MessageValidationConfig = DEFAULT_MESSAGE_VALIDATION,
): void {
  if (attachments.length > config.maxAttachments) {
    throw new ValidationError(
      `Too many attachments. Maximum is ${config.maxAttachments}`,
      'attachments',
      { details: { actual: attachments.length, max: config.maxAttachments } },
    );
  }
}

/**
 * Sanitize message content (remove harmful patterns)
 */
export function sanitizeContent(content: string): string {
  return content
    .trim()
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
}

/**
 * Validate complete message creation params
 */
export function validateCreateMessageParams(
  params: CreateMessageParams,
  config: MessageValidationConfig = DEFAULT_MESSAGE_VALIDATION,
): void {
  // Validate role
  validateRole(params.role);

  // Validate content
  validateContentLength(params.content, config);

  // Validate attachments if present
  if (params.attachments && params.attachments.length > 0) {
    validateAttachmentCount(params.attachments, config);
  }

  // Validate chatId is not empty
  if (!params.chatId || params.chatId.trim().length === 0) {
    throw new ValidationError('Chat ID is required', 'chatId');
  }
}

/**
 * Check if message is from user
 */
export function isUserMessage(message: Message): boolean {
  return message.role === 'user';
}

/**
 * Check if message is from assistant
 */
export function isAssistantMessage(message: Message): boolean {
  return message.role === 'assistant';
}

/**
 * Check if message has attachments
 */
export function hasAttachments(message: Message): boolean {
  return Boolean(message.attachments && message.attachments.length > 0);
}

/**
 * Extract text content from message (including attachment text)
 */
export function getFullTextContent(message: Message): string {
  let fullText = message.content;

  if (message.attachments) {
    const attachmentTexts = message.attachments
      .map((a) => a.extractedText)
      .filter((text): text is string => Boolean(text));

    if (attachmentTexts.length > 0) {
      fullText += '\n\n' + attachmentTexts.join('\n\n');
    }
  }

  return fullText;
}

/**
 * Count tokens (rough estimate: 1 token ≈ 4 characters for English)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if conversation would exceed token limit
 */
export function wouldExceedTokenLimit(
  messages: ReadonlyArray<Message>,
  tokenLimit: number,
): boolean {
  const totalTokens = messages.reduce((sum, msg) => {
    const content = getFullTextContent(msg);
    return sum + estimateTokens(content);
  }, 0);

  return totalTokens > tokenLimit;
}
