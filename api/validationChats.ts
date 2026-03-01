import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

const OptionalString = z.string().nullable().optional();
const OptionalArray = z.array(z.unknown()).nullable().optional();
const OptionalNumber = z.number().nullable().optional();

export const ChatRecordSchema = z
  .object({
    id: z.string(),
    title: OptionalString,
    created_at: OptionalString,
    createdAt: OptionalString,
    updated_at: OptionalString,
    updatedAt: OptionalString,
    last_message_at: OptionalString,
    lastMessageAt: OptionalString,
  })
  .passthrough();

export type ChatRecord = z.infer<typeof ChatRecordSchema>;

export const ChatListResponseSchema = z
  .object({
    chats: z.array(ChatRecordSchema),
    pagination: z
      .object({
        hasMore: z.boolean(),
        nextCursor: OptionalString,
      })
      .passthrough(),
  })
  .passthrough();

export const ChatMessageSchema = z
  .object({
    id: z.string(),
    role: OptionalString,
    created_at: OptionalString,
    createdAt: OptionalString,
    attachments: OptionalArray,
  })
  .passthrough();

export const ChatMessagesSchema = z.array(ChatMessageSchema);

export type ChatMessageRecord = z.infer<typeof ChatMessageSchema>;

export const ChatTitleResponseSchema = z
  .object({
    chatId: z.string(),
    title: z.string(),
  })
  .passthrough();

export const ChatAssetRecordSchema = z
  .object({
    id: z.string(),
    messageId: OptionalString,
    message_id: OptionalString,
    type: z.string(),
    mimeType: OptionalString,
    mime_type: OptionalString,
    fileName: OptionalString,
    file_name: OptionalString,
    fileSize: OptionalNumber,
    file_size: OptionalNumber,
    url: OptionalString,
    createdAt: OptionalString,
    created_at: OptionalString,
    processingStatus: OptionalString,
    processing_status: OptionalString,
    processingError: OptionalString,
    processing_error: OptionalString,
    processingUpdatedAt: OptionalString,
    processing_updated_at: OptionalString,
    processingCompletedAt: OptionalString,
    processing_completed_at: OptionalString,
  })
  .passthrough();

export type ChatAssetRecord = z.infer<typeof ChatAssetRecordSchema>;

export const ChatAssetRecordsSchema = z.array(ChatAssetRecordSchema);

export const ChatAssetStatusSchema = z
  .object({
    id: z.string(),
    processingStatus: OptionalString,
    processing_status: OptionalString,
    processingError: OptionalString,
    processing_error: OptionalString,
    processingUpdatedAt: OptionalString,
    processing_updated_at: OptionalString,
    processingCompletedAt: OptionalString,
    processing_completed_at: OptionalString,
  })
  .passthrough();

export type ChatAssetStatus = {
  id: string;
  processingStatus?: string | null;
  processingError?: string | null;
  processingUpdatedAt?: string | null;
  processingCompletedAt?: string | null;
};

function resolveChatAssetStatus(record: z.infer<typeof ChatAssetStatusSchema>): ChatAssetStatus {
  const status: ChatAssetStatus = { id: record.id };
  const processingStatus =
    record.processingStatus !== undefined ? record.processingStatus : record.processing_status;
  if (processingStatus !== undefined) {
    status.processingStatus = processingStatus;
  }
  const processingError =
    record.processingError !== undefined ? record.processingError : record.processing_error;
  if (processingError !== undefined) {
    status.processingError = processingError;
  }
  const processingUpdatedAt =
    record.processingUpdatedAt !== undefined
      ? record.processingUpdatedAt
      : record.processing_updated_at;
  if (processingUpdatedAt !== undefined) {
    status.processingUpdatedAt = processingUpdatedAt;
  }
  const processingCompletedAt =
    record.processingCompletedAt !== undefined
      ? record.processingCompletedAt
      : record.processing_completed_at;
  if (processingCompletedAt !== undefined) {
    status.processingCompletedAt = processingCompletedAt;
  }
  return status;
}

export function validateChatRecord(value: unknown, field = 'chat'): ChatRecord {
  return parseWithSchema(ChatRecordSchema, value, field);
}

export function validateChatListResponse(
  value: unknown,
  field = 'chatList',
): {
  chats: ChatRecord[];
  pagination: { hasMore: boolean; nextCursor?: string | null };
} {
  const result = parseWithSchema(ChatListResponseSchema, value, field);
  const pagination: { hasMore: boolean; nextCursor?: string | null } = {
    hasMore: result.pagination.hasMore,
  };
  if (result.pagination.nextCursor === null || typeof result.pagination.nextCursor === 'string') {
    pagination.nextCursor = result.pagination.nextCursor;
  }
  return { chats: result.chats, pagination };
}

export function validateChatMessages(value: unknown, field = 'chatMessages'): ChatMessageRecord[] {
  return parseWithSchema(ChatMessagesSchema, value, field);
}

export function validateChatTitleResponse(
  value: unknown,
  field = 'chatTitle',
): { chatId: string; title: string } {
  return parseWithSchema(ChatTitleResponseSchema, value, field);
}

export function validateChatAssetRecord(value: unknown, field = 'chatAsset'): ChatAssetRecord {
  return parseWithSchema(ChatAssetRecordSchema, value, field);
}

export function validateChatAssetRecords(value: unknown, field = 'chatAssets'): ChatAssetRecord[] {
  return parseWithSchema(ChatAssetRecordsSchema, value, field);
}

export function validateChatAssetStatus(
  value: unknown,
  field = 'chatAssetStatus',
): ChatAssetStatus {
  const record = parseWithSchema(ChatAssetStatusSchema, value, field);
  return resolveChatAssetStatus(record);
}
