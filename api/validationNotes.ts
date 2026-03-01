import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

const OptionalString = z.string().nullable().optional();
const OptionalArray = z.array(z.unknown()).nullable().optional();

export const NoteRecordSchema = z
  .object({
    id: z.string(),
    title: OptionalString,
    tags: OptionalArray,
    created_at: OptionalString,
    createdAt: OptionalString,
    updated_at: OptionalString,
    updatedAt: OptionalString,
  })
  .passthrough();

export type NoteRecord = z.infer<typeof NoteRecordSchema>;

export const NoteRecordsSchema = z.array(NoteRecordSchema);

export const NotesChatResponseSchema = z
  .object({
    answer: z.string(),
    usedNotes: NoteRecordsSchema,
  })
  .passthrough();

export const NoteAssetRecordSchema = z
  .object({
    id: z.string(),
    note_id: z.string(),
    user_id: z.string(),
    type: z.string(),
    mime_type: z.string(),
    storage_path: z.string(),
    created_at: z.string(),
    url: OptionalString,
    file_name: OptionalString,
  })
  .passthrough();

export type NoteAssetRecord = z.infer<typeof NoteAssetRecordSchema>;

export const NoteAssetRecordsSchema = z.array(NoteAssetRecordSchema);

export function validateNoteRecord(value: unknown, field = 'note'): NoteRecord {
  return parseWithSchema(NoteRecordSchema, value, field);
}

export function validateNoteRecords(value: unknown, field = 'notes'): NoteRecord[] {
  return parseWithSchema(NoteRecordsSchema, value, field);
}

export function validateNotesChatResponse(
  value: unknown,
  field = 'notesChat',
): {
  answer: string;
  usedNotes: NoteRecord[];
} {
  return parseWithSchema(NotesChatResponseSchema, value, field);
}

export function validateNoteAssetRecord(value: unknown, field = 'noteAsset'): NoteAssetRecord {
  return parseWithSchema(NoteAssetRecordSchema, value, field);
}

export function validateNoteAssetRecords(value: unknown, field = 'noteAssets'): NoteAssetRecord[] {
  return parseWithSchema(NoteAssetRecordsSchema, value, field);
}
