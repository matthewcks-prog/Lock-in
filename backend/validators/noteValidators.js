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

/**
 * Schema for creating a note
 * POST /api/notes
 */
const createNoteSchema = z
  .object({
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
    tags: z.union([z.array(z.string().max(50)), z.string(), z.null()]).optional(),
  })
  .refine(
    (data) => {
      // Accept if valid Lexical format is present (content_json + editor_version)
      // This is the preferred modern format
      const hasLexical = data.content_json && data.editor_version;
      if (hasLexical) {
        return true;
      }

      // Otherwise, require legacy content with actual text
      // Note: Frontend may send empty 'content' field as fallback when using Lexical,
      // so we only validate legacy content if Lexical format is NOT present
      const hasLegacy =
        data.content && typeof data.content === 'string' && data.content.trim().length > 0;
      return hasLegacy;
    },
    {
      message:
        'Note must contain either Lexical format (content_json + editor_version) or legacy format (content with text)',
    },
  );

/**
 * Schema for updating a note
 * PUT /api/notes/:noteId
 */
const updateNoteSchema = createNoteSchema; // Same validation as create

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
  k: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Schema for listing notes
 * GET /api/notes
 */
const listNotesSchema = z.object({
  sourceUrl: z.string().optional(),
  courseCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Schema for chat with notes
 * POST /api/notes/chat
 */
const chatWithNotesSchema = z.object({
  query: z.string().min(1, 'Query is required and cannot be empty'),
  courseCode: z.string().optional(),
  k: z.coerce.number().int().min(1).max(20).optional(),
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
