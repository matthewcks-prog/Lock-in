// backend/validators/noteValidators.js

const { z } = require('zod');
const { MAX_NOTE_CONTENT_LENGTH, MAX_NOTE_TITLE_LENGTH } = require('../utils/noteLimits');

/**
 * Note Validation Schemas
 *
 * Declarative validation for note-related endpoints.
 * Replaces imperative validation in controllers.
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

// Lexical JSON schema (basic validation)
const lexicalJsonSchema = z.object({}).passthrough(); // Allow any object structure

// Content limits
const MAX_CONTENT_LENGTH = MAX_NOTE_CONTENT_LENGTH;
const MAX_TAG_LENGTH = 50;
const MAX_SEARCH_NOTES_K = 50;
const MAX_LIST_NOTES_LIMIT = 100;
const MAX_CHAT_NOTES_K = 20;
const MAX_NOTE_WEEK = 52;

/**
 * Shared content validation: accept Lexical (content_json + editor_version)
 * or legacy HTML (content with non-empty text).
 */
function hasValidContent(data) {
  const hasLexical = data.content_json && data.editor_version;
  if (hasLexical) return true;
  // Note: Frontend may send empty 'content' as fallback when using Lexical.
  const hasLegacy =
    data.content && typeof data.content === 'string' && data.content.trim().length > 0;
  return Boolean(hasLegacy);
}

const CONTENT_VALIDATION_MESSAGE =
  'Note must contain either Lexical format (content_json + editor_version) or legacy format (content with text)';

/**
 * Base shape shared between create and update.
 * Extracted so that .omit() can be applied before .refine().
 * (Zod does not allow .omit() on ZodEffects produced by .refine().)
 */
const noteBaseSchema = z.object({
  title: z.string().max(MAX_NOTE_TITLE_LENGTH).optional().nullable(),
  content: z.string().optional().nullable(), // Legacy field
  content_json: z.union([z.string(), lexicalJsonSchema]).optional().nullable(),
  editor_version: z.string().optional().nullable(),
  content_text: z.string().max(MAX_CONTENT_LENGTH).optional().nullable(),
  clientNoteId: uuidSchema.optional().nullable(),
  sourceSelection: z.string().optional().nullable(),
  sourceUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  courseCode: z.string().optional().nullable(),
  noteType: z.string().optional().nullable(),
  tags: z.union([z.array(z.string().max(MAX_TAG_LENGTH)), z.string(), z.null()]).optional(),
  week: z.number().int().min(1).max(MAX_NOTE_WEEK).optional().nullable(),
});

/**
 * Schema for creating a note
 * POST /api/notes
 */
const createNoteSchema = noteBaseSchema.refine(hasValidContent, {
  message: CONTENT_VALIDATION_MESSAGE,
});

/**
 * Schema for updating a note
 * PUT /api/notes/:noteId
 *
 * sourceUrl is intentionally absent: the note's origin URL is immutable
 * after creation and must never be overwritten via an update.
 */
const updateNoteSchema = noteBaseSchema.omit({ sourceUrl: true }).refine(hasValidContent, {
  message: CONTENT_VALIDATION_MESSAGE,
});

/**
 * Schema for note ID parameter
 * Used in GET/PUT/DELETE /api/notes/:noteId
 */
const noteIdParamSchema = z.object({
  noteId: uuidSchema,
});

/**
 * Schema for searching notes
 * GET /api/notes/search
 */
const searchNotesSchema = z.object({
  q: z.string().min(1, 'Query parameter (q) is required'),
  courseCode: z.string().optional(),
  k: z.coerce.number().int().min(1).max(MAX_SEARCH_NOTES_K).optional(),
});

/**
 * Schema for listing notes
 * GET /api/notes
 */
const listNotesSchema = z.object({
  sourceUrl: z.string().optional(),
  courseCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_NOTES_LIMIT).optional(),
});

/**
 * Schema for chat with notes
 * POST /api/notes/chat
 */
const chatWithNotesSchema = z.object({
  query: z.string().min(1, 'Query is required and cannot be empty'),
  courseCode: z.string().optional(),
  k: z.coerce.number().int().min(1).max(MAX_CHAT_NOTES_K).optional(),
});

/**
 * Schema for toggling/setting starred status
 * PUT /api/notes/:noteId/star
 */
const setStarredSchema = z.object({
  isStarred: z.boolean(),
});

module.exports = {
  createNoteSchema,
  updateNoteSchema,
  noteIdParamSchema,
  searchNotesSchema,
  listNotesSchema,
  chatWithNotesSchema,
  setStarredSchema,
};
