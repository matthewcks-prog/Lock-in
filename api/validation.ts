import { ValidationError } from '../core/errors';

type RecordValue = Record<string, unknown>;

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createTypeError(field: string, expected: string, value: unknown): ValidationError {
  return new ValidationError(`Expected ${field} to be ${expected}`, field, {
    details: {
      expected,
      received: describeType(value),
    },
  });
}

function assertRecord(value: unknown, field: string): RecordValue {
  if (!isRecord(value)) {
    throw createTypeError(field, 'object', value);
  }
  return value;
}

function assertArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw createTypeError(field, 'array', value);
  }
  return value;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw createTypeError(field, 'string', value);
  }
  return value;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw createTypeError(field, 'boolean', value);
  }
  return value;
}

function assertOptionalString(value: unknown, field: string): void {
  if (value == null) return;
  if (typeof value !== 'string') {
    throw createTypeError(field, 'string|null', value);
  }
}

function assertOptionalNumber(value: unknown, field: string): void {
  if (value == null) return;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw createTypeError(field, 'number|null', value);
  }
}

function assertOptionalArray(value: unknown, field: string): void {
  if (value == null) return;
  if (!Array.isArray(value)) {
    throw createTypeError(field, 'array|null', value);
  }
}

export function validateNoteRecord(value: unknown, field = 'note'): RecordValue {
  const record = assertRecord(value, field);
  assertString(record['id'], `${field}.id`);
  if ('title' in record) {
    assertOptionalString(record['title'], `${field}.title`);
  }
  if ('tags' in record) {
    assertOptionalArray(record['tags'], `${field}.tags`);
  }
  if ('created_at' in record) {
    assertOptionalString(record['created_at'], `${field}.created_at`);
  }
  if ('createdAt' in record) {
    assertOptionalString(record['createdAt'], `${field}.createdAt`);
  }
  if ('updated_at' in record) {
    assertOptionalString(record['updated_at'], `${field}.updated_at`);
  }
  if ('updatedAt' in record) {
    assertOptionalString(record['updatedAt'], `${field}.updatedAt`);
  }
  return record;
}

export function validateNoteRecords(value: unknown, field = 'notes'): RecordValue[] {
  const list = assertArray(value, field);
  return list.map((item, index) => validateNoteRecord(item, `${field}[${index}]`));
}

export function validateNotesChatResponse(
  value: unknown,
  field = 'notesChat',
): {
  answer: string;
  usedNotes: RecordValue[];
} {
  const record = assertRecord(value, field);
  const answer = assertString(record['answer'], `${field}.answer`);
  const usedNotes = validateNoteRecords(record['usedNotes'], `${field}.usedNotes`);
  return { answer, usedNotes };
}

export function validateChatRecord(value: unknown, field = 'chat'): RecordValue {
  const record = assertRecord(value, field);
  assertString(record['id'], `${field}.id`);
  if ('title' in record) {
    assertOptionalString(record['title'], `${field}.title`);
  }
  if ('createdAt' in record) {
    assertOptionalString(record['createdAt'], `${field}.createdAt`);
  }
  if ('created_at' in record) {
    assertOptionalString(record['created_at'], `${field}.created_at`);
  }
  if ('updatedAt' in record) {
    assertOptionalString(record['updatedAt'], `${field}.updatedAt`);
  }
  if ('updated_at' in record) {
    assertOptionalString(record['updated_at'], `${field}.updated_at`);
  }
  if ('lastMessageAt' in record) {
    assertOptionalString(record['lastMessageAt'], `${field}.lastMessageAt`);
  }
  if ('last_message_at' in record) {
    assertOptionalString(record['last_message_at'], `${field}.last_message_at`);
  }
  return record;
}

export function validateChatListResponse(
  value: unknown,
  field = 'chatList',
): {
  chats: RecordValue[];
  pagination: { hasMore: boolean; nextCursor?: string | null };
} {
  const record = assertRecord(value, field);
  const chats = assertArray(record['chats'], `${field}.chats`).map((chat, index) =>
    validateChatRecord(chat, `${field}.chats[${index}]`),
  );
  const pagination = assertRecord(record['pagination'], `${field}.pagination`);
  const hasMore = assertBoolean(pagination['hasMore'], `${field}.pagination.hasMore`);
  if ('nextCursor' in pagination) {
    assertOptionalString(pagination['nextCursor'], `${field}.pagination.nextCursor`);
  }
  return {
    chats,
    pagination: (() => {
      const paginationResult: { hasMore: boolean; nextCursor?: string | null } = { hasMore };
      if (typeof pagination['nextCursor'] === 'string' || pagination['nextCursor'] === null) {
        paginationResult.nextCursor = pagination['nextCursor'];
      }
      return paginationResult;
    })(),
  };
}

export function validateChatMessages(value: unknown, field = 'chatMessages'): RecordValue[] {
  const list = assertArray(value, field);
  return list.map((item, index) => {
    const record = assertRecord(item, `${field}[${index}]`);
    assertString(record['id'], `${field}[${index}].id`);
    if ('role' in record) {
      assertOptionalString(record['role'], `${field}[${index}].role`);
    }
    if ('created_at' in record) {
      assertOptionalString(record['created_at'], `${field}[${index}].created_at`);
    }
    if ('createdAt' in record) {
      assertOptionalString(record['createdAt'], `${field}[${index}].createdAt`);
    }
    if ('attachments' in record) {
      assertOptionalArray(record['attachments'], `${field}[${index}].attachments`);
    }
    return record;
  });
}

export function validateChatTitleResponse(
  value: unknown,
  field = 'chatTitle',
): {
  chatId: string;
  title: string;
} {
  const record = assertRecord(value, field);
  const chatId = assertString(record['chatId'], `${field}.chatId`);
  const title = assertString(record['title'], `${field}.title`);
  return { chatId, title };
}

export function validateNoteAssetRecord(value: unknown, field = 'noteAsset'): RecordValue {
  const record = assertRecord(value, field);
  assertString(record['id'], `${field}.id`);
  assertString(record['note_id'], `${field}.note_id`);
  assertString(record['user_id'], `${field}.user_id`);
  assertString(record['type'], `${field}.type`);
  assertString(record['mime_type'], `${field}.mime_type`);
  assertString(record['storage_path'], `${field}.storage_path`);
  assertString(record['created_at'], `${field}.created_at`);
  if ('url' in record) {
    assertOptionalString(record['url'], `${field}.url`);
  }
  if ('file_name' in record) {
    assertOptionalString(record['file_name'], `${field}.file_name`);
  }
  return record;
}

export function validateNoteAssetRecords(value: unknown, field = 'noteAssets'): RecordValue[] {
  const list = assertArray(value, field);
  return list.map((item, index) => validateNoteAssetRecord(item, `${field}[${index}]`));
}

export function validateChatAssetRecord(value: unknown, field = 'chatAsset'): RecordValue {
  const record = assertRecord(value, field);
  assertString(record['id'], `${field}.id`);
  if ('messageId' in record) {
    assertOptionalString(record['messageId'], `${field}.messageId`);
  }
  if ('message_id' in record) {
    assertOptionalString(record['message_id'], `${field}.message_id`);
  }
  assertString(record['type'], `${field}.type`);
  if ('mimeType' in record) {
    assertOptionalString(record['mimeType'], `${field}.mimeType`);
  }
  if ('mime_type' in record) {
    assertOptionalString(record['mime_type'], `${field}.mime_type`);
  }
  if ('fileName' in record) {
    assertOptionalString(record['fileName'], `${field}.fileName`);
  }
  if ('file_name' in record) {
    assertOptionalString(record['file_name'], `${field}.file_name`);
  }
  if ('fileSize' in record) {
    assertOptionalNumber(record['fileSize'], `${field}.fileSize`);
  }
  if ('file_size' in record) {
    assertOptionalNumber(record['file_size'], `${field}.file_size`);
  }
  if ('url' in record) {
    assertOptionalString(record['url'], `${field}.url`);
  }
  if ('createdAt' in record) {
    assertOptionalString(record['createdAt'], `${field}.createdAt`);
  }
  if ('created_at' in record) {
    assertOptionalString(record['created_at'], `${field}.created_at`);
  }
  return record;
}

export function validateChatAssetRecords(value: unknown, field = 'chatAssets'): RecordValue[] {
  const list = assertArray(value, field);
  return list.map((item, index) => validateChatAssetRecord(item, `${field}[${index}]`));
}

export function validateTranscriptCacheResponse(
  value: unknown,
  field = 'transcriptCache',
): {
  success: boolean;
  fingerprint?: string;
  cachedAt?: string;
} {
  const record = assertRecord(value, field);
  const success = assertBoolean(record['success'], `${field}.success`);
  if ('fingerprint' in record) {
    assertOptionalString(record['fingerprint'], `${field}.fingerprint`);
  }
  if ('cachedAt' in record) {
    assertOptionalString(record['cachedAt'], `${field}.cachedAt`);
  }
  const response: { success: boolean; fingerprint?: string; cachedAt?: string } = { success };
  if (typeof record['fingerprint'] === 'string') {
    response.fingerprint = record['fingerprint'];
  }
  if (typeof record['cachedAt'] === 'string') {
    response.cachedAt = record['cachedAt'];
  }
  return response;
}
