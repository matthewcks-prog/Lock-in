/**
 * Note domain model (UI/editor agnostic).
 *
 * This file intentionally avoids importing React or Lexical types.
 * Lexical editor state is treated as opaque structured JSON and only
 * parsed/serialized inside the editor adapter layer.
 */

import { z } from 'zod';
import type { ZodError } from 'zod';
import { ValidationError } from '../errors';

const NoteContentVersionSchema = z.enum(['lexical_v1', 'legacy_html']);

export type NoteContentVersion = z.infer<typeof NoteContentVersionSchema>;

const NoteContentSchema = z
  .object({
    version: NoteContentVersionSchema,
    /**
     * Structured editor state (opaque to the domain layer).
     * The Lexical editor serializes to JSON; we keep it as unknown here.
     */
    editorState: z.unknown(),
    /**
     * Optional HTML fallback from legacy contentEditable storage.
     * Used only as a migration path.
     */
    legacyHtml: z.string().nullable().optional(),
    /**
     * Optional plain-text preview for list rendering/search.
     */
    plainText: z.string().nullable().optional(),
  })
  .passthrough();

export type NoteContent = z.infer<typeof NoteContentSchema>;

const NoteStatusSchema = z.enum(['idle', 'editing', 'saving', 'saved', 'error']);
export type NoteStatus = z.infer<typeof NoteStatusSchema>;

const NoteTypeSchema = z.enum([
  'manual',
  'definition',
  'formula',
  'concept',
  'general',
  'ai-generated',
  'transcript',
  'quiz',
  'key_takeaways',
]);

export type NoteType = z.infer<typeof NoteTypeSchema>;

const NoteAssetTypeSchema = z.enum(['image', 'document', 'audio', 'video', 'other']);
export type NoteAssetType = z.infer<typeof NoteAssetTypeSchema>;

const NoteAssetSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  userId: z.string(),
  type: NoteAssetTypeSchema,
  mimeType: z.string(),
  storagePath: z.string(),
  createdAt: z.string(), // ISO string from backend
  url: z.string(),
  fileName: z.string().nullable().optional(),
});

export type NoteAsset = z.infer<typeof NoteAssetSchema>;

const NoteSchema = z
  .object({
    id: z.string().nullable(),
    title: z.string().min(1),
    content: NoteContentSchema,
    sourceUrl: z.string().nullable(),
    sourceSelection: z.string().nullable().optional(),
    courseCode: z.string().nullable(),
    noteType: NoteTypeSchema,
    tags: z.array(z.string()),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
    linkedLabel: z.string().optional(),
    isStarred: z.boolean().optional(),
    previewText: z.string().nullable().optional(),
  })
  .passthrough();

export type Note = z.infer<typeof NoteSchema>;

type ZodIssueDetails = {
  issues: ZodError['issues'];
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
};

function formatZodError(error: ZodError): ZodIssueDetails {
  const flattened = error.flatten();
  return {
    issues: error.issues,
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };
}

export function parseNote(value: unknown, field = 'note'): Note {
  const result = NoteSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new ValidationError(`Invalid ${field}`, field, {
    details: formatZodError(result.error),
  });
}

export { NoteAssetSchema, NoteContentSchema, NoteSchema };
