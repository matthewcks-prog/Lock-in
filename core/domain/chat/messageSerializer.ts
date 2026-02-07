/**
 * Pure functions for serializing/deserializing messages
 * Used for API transport, caching, storage
 */

import { ValidationError } from '../../errors/index.js';
import type { Message, MessageAttachment, Conversation } from './Message.js';
import { validateRole } from './messageValidation.js';

const COERCIBLE_TYPES = ['string', 'number', 'boolean'] as const;
const ATTACHMENT_TYPES: ReadonlyArray<MessageAttachment['type']> = ['image', 'document', 'text'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const ensureRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (isRecord(value)) return value;
  throw new ValidationError(`Invalid ${field} payload`, field);
};

const readField = (data: Record<string, unknown>, field: string): unknown => {
  if (!(field in data)) {
    throw new ValidationError(`Missing ${field}`, field);
  }
  const value = data[field];
  if (value === null || value === undefined) {
    throw new ValidationError(`Missing ${field}`, field);
  }
  return value;
};

const coerceString = (value: unknown, field: string): string => {
  if (COERCIBLE_TYPES.includes(typeof value as (typeof COERCIBLE_TYPES)[number])) {
    return String(value);
  }
  throw new ValidationError(`Invalid ${field}`, field);
};

const parseOptionalString = (value: unknown, field: string): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return coerceString(value, field);
};

const parseNumber = (value: unknown, field: string): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new ValidationError(`Invalid ${field}`, field);
};

const parseDate = (value: unknown, field: string): Date => {
  const date = typeof value === 'number' ? new Date(value) : new Date(coerceString(value, field));
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${field}`, field);
  }
  return date;
};

const parseAttachmentType = (value: unknown): MessageAttachment['type'] => {
  if (typeof value === 'string') {
    const candidate = value as MessageAttachment['type'];
    if (ATTACHMENT_TYPES.includes(candidate)) {
      return candidate;
    }
  }
  throw new ValidationError('Invalid attachment type', 'type');
};

const parseMetadata = (value: unknown): Message['metadata'] | undefined => {
  if (value === null || value === undefined) return undefined;
  if (isRecord(value)) return value as Message['metadata'];
  throw new ValidationError('Invalid metadata', 'metadata');
};

const parseAttachments = (value: unknown): ReadonlyArray<MessageAttachment> | undefined => {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ValidationError('Invalid attachments', 'attachments');
  }
  return value.map((item) => deserializeAttachment(item));
};

/**
 * Serialize message to JSON-safe object
 */
export function serializeMessage(message: Message): Record<string, unknown> {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map(serializeAttachment),
    createdAt: message.createdAt.toISOString(),
    metadata: message.metadata,
  };
}

/**
 * Deserialize message from JSON object
 */
export function deserializeMessage(data: unknown): Message {
  const record = ensureRecord(data, 'message');
  const attachments = parseAttachments(record['attachments']);
  const metadata = parseMetadata(record['metadata']);

  return {
    id: coerceString(readField(record, 'id'), 'id'),
    chatId: coerceString(readField(record, 'chatId'), 'chatId'),
    role: validateRole(coerceString(readField(record, 'role'), 'role')),
    content: coerceString(readField(record, 'content'), 'content'),
    createdAt: parseDate(readField(record, 'createdAt'), 'createdAt'),
    ...(attachments !== undefined ? { attachments } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/**
 * Serialize attachment to JSON-safe object
 */
export function serializeAttachment(attachment: MessageAttachment): Record<string, unknown> {
  return {
    id: attachment.id,
    type: attachment.type,
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    url: attachment.url,
    extractedText: attachment.extractedText,
  };
}

/**
 * Deserialize attachment from JSON object
 */
export function deserializeAttachment(data: unknown): MessageAttachment {
  const record = ensureRecord(data, 'attachment');
  const url = parseOptionalString(record['url'], 'url');
  const extractedText = parseOptionalString(record['extractedText'], 'extractedText');
  return {
    id: coerceString(readField(record, 'id'), 'id'),
    type: parseAttachmentType(readField(record, 'type')),
    mimeType: coerceString(readField(record, 'mimeType'), 'mimeType'),
    fileName: coerceString(readField(record, 'fileName'), 'fileName'),
    fileSize: parseNumber(readField(record, 'fileSize'), 'fileSize'),
    ...(url !== undefined ? { url } : {}),
    ...(extractedText !== undefined ? { extractedText } : {}),
  };
}

/**
 * Serialize conversation to JSON-safe object
 */
export function serializeConversation(conversation: Conversation): Record<string, unknown> {
  return {
    id: conversation.id,
    userId: conversation.userId,
    title: conversation.title,
    messages: conversation.messages.map(serializeMessage),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString(),
  };
}

/**
 * Convert message to LLM provider format (OpenAI/Anthropic-style)
 */
export function toProviderMessage(message: Message): {
  role: string;
  content: string;
} {
  let content = message.content;

  // Include attachment text inline
  if (message.attachments && message.attachments.length > 0) {
    const attachmentTexts = message.attachments
      .map((a) => a.extractedText)
      .filter((text): text is string => Boolean(text));

    if (attachmentTexts.length > 0) {
      content += '\n\n[Attached content]\n' + attachmentTexts.join('\n\n');
    }
  }

  return {
    role: message.role,
    content,
  };
}

/**
 * Convert array of messages to provider format
 */
export function toProviderMessages(
  messages: ReadonlyArray<Message>,
): Array<{ role: string; content: string }> {
  return messages.map(toProviderMessage);
}

/**
 * Extract conversation history for LLM context
 * Optionally limit to recent messages
 */
export function extractConversationHistory(
  messages: ReadonlyArray<Message>,
  limit?: number,
): ReadonlyArray<Message> {
  if (!limit || messages.length <= limit) {
    return messages;
  }

  // Take most recent messages
  return messages.slice(-limit);
}

/**
 * Format message for display (strips metadata, formats attachments)
 */
export function formatForDisplay(message: Message): {
  id: string;
  role: string;
  content: string;
  hasAttachments: boolean;
  attachmentCount: number;
  timestamp: string;
} {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    hasAttachments: Boolean(message.attachments && message.attachments.length > 0),
    attachmentCount: message.attachments?.length || 0,
    timestamp: message.createdAt.toISOString(),
  };
}
