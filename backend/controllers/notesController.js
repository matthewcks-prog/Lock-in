// backend/controllers/notesController.js

const notesRepo = require('../repositories/notesRepository');
const noteAssetsRepo = require('../repositories/noteAssetsRepository');
const { supabase } = require('../supabaseClient');
const { NOTE_ASSETS_BUCKET } = require('../config');
const { embedText } = require('../services/embeddings');
const { extractPlainTextFromLexical } = require('../utils/lexicalUtils');

/**
 * Notes controller with scalability features:
 * - Input validation with clear error messages
 * - Optimistic locking for concurrent edit detection
 * - Graceful embedding failure handling
 * - Rate-limit friendly responses
 */

// Content limits for scalability
const MAX_CONTENT_LENGTH = 50000; // 50k characters
const MAX_TITLE_LENGTH = 500;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

/**
 * Normalize tags to ensure consistent array format
 * @param {any} tags - Tags input (array, string, or null/undefined)
 * @returns {string[]} Normalized array of tags
 */
function normaliseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
      .slice(0, MAX_TAGS) // Limit number of tags
      .map((tag) => tag.trim().slice(0, MAX_TAG_LENGTH)); // Limit tag length
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, MAX_TAGS)
      .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
  }
  return [];
}

/**
 * Validate and sanitize title
 */
function validateTitle(title) {
  if (!title || typeof title !== 'string') {
    return 'Untitled Note';
  }
  return title.trim().slice(0, MAX_TITLE_LENGTH) || 'Untitled Note';
}

/**
 * Validate UUID format
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// POST /api/notes
async function createNote(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      title,
      content, // Legacy field (fallback)
      content_json, // Lexical JSON state
      editor_version, // Editor version (e.g., 'lexical_v1')
      content_text, // Plain text extracted from Lexical
      clientNoteId,
      sourceSelection,
      sourceUrl,
      courseCode,
      noteType,
      tags,
    } = req.body;

    // Debug logging (remove in production or use proper log levels)
    if (process.env.NODE_ENV !== 'production') {
      console.log('createNote request body keys:', Object.keys(req.body));
      console.log('content_json type:', typeof content_json);
      console.log('editor_version:', editor_version);
    }

    // Determine which content format we're using
    const hasLexicalContent = content_json && editor_version;
    const hasLegacyContent = content && typeof content === 'string' && content.trim().length > 0;

    if (!hasLexicalContent && !hasLegacyContent) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message:
            'content_json and editor_version are required, or legacy content field must be provided',
        },
      });
    }

    // Ensure content_json is always an object (required by database)
    let finalContentJson = {};
    let finalEditorVersion = 'lexical_v1';

    if (hasLexicalContent) {
      // Validate content_json is an object
      if (typeof content_json === 'string') {
        try {
          finalContentJson = JSON.parse(content_json);
        } catch {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'content_json must be a valid JSON object',
            },
          });
        }
      } else if (typeof content_json === 'object' && content_json !== null) {
        finalContentJson = content_json;
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'content_json must be a valid JSON object',
          },
        });
      }
      finalEditorVersion = editor_version;
    }

    // Extract plain text for embedding
    let plainText = '';
    if (hasLexicalContent) {
      // Use provided content_text or extract from Lexical JSON
      plainText = content_text || extractPlainTextFromLexical(finalContentJson) || '';
    } else {
      // Legacy: use content field (strip HTML if present)
      plainText = content.trim();
      // Basic HTML stripping for legacy content
      plainText = plainText
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (!plainText || plainText.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Note content cannot be empty',
        },
      });
    }

    // Validate content length (prevent extremely long notes)
    if (plainText.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTENT_TOO_LONG',
          message: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`,
        },
      });
    }

    // Generate embedding for semantic search
    let embedding;
    try {
      embedding = await embedText(plainText);
    } catch (embedError) {
      // Log but don't fail - note can still be saved without embedding
      console.error('Failed to generate embedding:', embedError);
      // Continue without embedding (note will not be searchable via semantic search)
      embedding = null;
    }

    const normalizedClientNoteId = typeof clientNoteId === 'string' ? clientNoteId.trim() : null;

    if (normalizedClientNoteId && !isValidUUID(normalizedClientNoteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CLIENT_NOTE_ID',
          message: 'clientNoteId must be a valid UUID',
        },
      });
    }

    const note = await notesRepo.createNote({
      userId,
      clientNoteId: normalizedClientNoteId,
      title: validateTitle(title),
      contentJson: finalContentJson,
      editorVersion: finalEditorVersion,
      contentPlain: plainText,
      legacyContent: hasLegacyContent ? content.trim() : null,
      sourceSelection: sourceSelection?.trim() || null,
      sourceUrl: sourceUrl?.trim() || null,
      courseCode: courseCode?.trim() || null,
      noteType: noteType || 'manual',
      tags: normaliseTags(tags),
      embedding,
    });

    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes?sourceUrl=&courseCode=&limit=
async function listNotes(req, res, next) {
  try {
    const userId = req.user.id;
    const { sourceUrl, courseCode, limit } = req.query;

    // Validate and limit the limit parameter
    const noteLimit = limit
      ? Math.min(Math.max(parseInt(limit, 10), 1), 100) // Between 1 and 100
      : 50;

    const notes = await notesRepo.listNotes({
      userId,
      sourceUrl: sourceUrl?.trim() || undefined,
      courseCode: courseCode?.trim() || undefined,
      limit: noteLimit,
    });

    res.json(notes);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/search?q=...&courseCode=
async function searchNotes(req, res, next) {
  try {
    const userId = req.user.id;
    const { q, courseCode, k } = req.query;

    // Validate query parameter
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'query parameter (q) is required' },
      });
    }

    // Validate and limit k parameter
    const matchCount = k ? Math.min(Math.max(parseInt(k, 10), 1), 50) : 10; // Between 1 and 50

    // Generate embedding for search query
    let queryEmbedding;
    try {
      queryEmbedding = await embedText(q.trim());
    } catch (embedError) {
      console.error('Failed to generate query embedding:', embedError);
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to process search query' },
      });
    }

    // Search notes by embedding similarity
    let matches = await notesRepo.searchNotesByEmbedding({
      userId,
      queryEmbedding,
      matchCount,
    });

    // Optional filter by course code
    if (courseCode) {
      matches = matches.filter((n) => n.course_code === courseCode);
    }

    res.json(matches);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/:noteId
async function getNote(req, res, next) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NOTE_ID',
          message: 'noteId is required',
        },
      });
    }

    // Validate UUID format to prevent invalid queries
    if (!isValidUUID(noteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NOTE_ID',
          message: 'noteId must be a valid UUID',
        },
      });
    }

    const note = await notesRepo.getNoteForUser({ userId, noteId });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Note not found',
        },
      });
    }

    res.json(note);
  } catch (err) {
    next(err);
  }
}

// PUT /api/notes/:noteId
// Supports optimistic locking via If-Unmodified-Since header
async function updateNote(req, res, next) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const ifUnmodifiedSince = req.headers['if-unmodified-since'];
    const {
      title,
      content, // Legacy field (fallback)
      content_json, // Lexical JSON state
      editor_version, // Editor version (e.g., 'lexical_v1')
      content_text, // Plain text extracted from Lexical
      sourceSelection,
      sourceUrl,
      courseCode,
      noteType,
      tags,
    } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NOTE_ID',
          message: 'noteId is required',
        },
      });
    }

    // Validate UUID format
    if (!isValidUUID(noteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NOTE_ID',
          message: 'noteId must be a valid UUID',
        },
      });
    }

    // Determine which content format we're using
    const hasLexicalContent = content_json && editor_version;
    const hasLegacyContent = content && typeof content === 'string' && content.trim().length > 0;

    if (!hasLexicalContent && !hasLegacyContent) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message:
            'content_json and editor_version are required, or legacy content field must be provided',
        },
      });
    }

    // Ensure content_json is always an object (required by database)
    let finalContentJson = {};
    let finalEditorVersion = 'lexical_v1';

    if (hasLexicalContent) {
      // Validate content_json is an object
      if (typeof content_json === 'string') {
        try {
          finalContentJson = JSON.parse(content_json);
        } catch {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'content_json must be a valid JSON object',
            },
          });
        }
      } else if (typeof content_json === 'object' && content_json !== null) {
        finalContentJson = content_json;
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'content_json must be a valid JSON object',
          },
        });
      }
      finalEditorVersion = editor_version;
    }

    // Extract plain text for embedding
    let plainText = '';
    if (hasLexicalContent) {
      // Use provided content_text or extract from Lexical JSON
      plainText = content_text || extractPlainTextFromLexical(finalContentJson) || '';
    } else {
      // Legacy: use content field (strip HTML if present)
      plainText = content.trim();
      // Basic HTML stripping for legacy content
      plainText = plainText
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (!plainText || plainText.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Note content cannot be empty',
        },
      });
    }

    // Validate content length
    if (plainText.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTENT_TOO_LONG',
          message: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`,
        },
      });
    }

    let embedding;
    try {
      embedding = await embedText(plainText);
    } catch (embedError) {
      console.error('Failed to regenerate embedding:', embedError);
      embedding = null;
    }

    const note = await notesRepo.updateNote({
      userId,
      noteId,
      title: validateTitle(title),
      contentJson: finalContentJson,
      editorVersion: finalEditorVersion,
      contentPlain: plainText,
      legacyContent: hasLegacyContent ? content.trim() : null,
      sourceSelection: sourceSelection?.trim() || null,
      sourceUrl: sourceUrl?.trim() || null,
      courseCode: courseCode?.trim() || null,
      noteType: noteType || 'manual',
      tags: normaliseTags(tags),
      embedding,
      ifUnmodifiedSince: ifUnmodifiedSince || null,
    });

    res.json(note);
  } catch (err) {
    // Handle conflict error from optimistic locking
    if (err.name === 'ConflictError' || err.status === 409) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: err.message || 'Note was modified by another session',
          updatedAt: err.updatedAt,
        },
      });
    }

    // Handle not found
    if (err.status === 404) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Note not found',
        },
      });
    }

    next(err);
  }
}

// DELETE /api/notes/:noteId
async function deleteNote(req, res, next) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: { message: 'noteId is required' },
      });
    }

    // Validate UUID format
    if (!isValidUUID(noteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NOTE_ID',
          message: 'noteId must be a valid UUID',
        },
      });
    }

    // First, clean up any associated assets from storage
    // The database records will be deleted via CASCADE when the note is deleted
    try {
      const assets = await noteAssetsRepo.listAssetsForNote(noteId, userId);
      if (assets && assets.length > 0) {
        const storagePaths = assets.map((asset) => asset.storage_path);
        const { error: storageError } = await supabase.storage
          .from(NOTE_ASSETS_BUCKET)
          .remove(storagePaths);

        if (storageError) {
          console.error('Failed to delete asset files from storage:', storageError);
          // Continue with note deletion even if storage cleanup fails
          // The orphaned files can be cleaned up later
        }
      }
    } catch (assetErr) {
      console.error('Error cleaning up assets:', assetErr);
      // Continue with note deletion even if asset cleanup fails
    }

    await notesRepo.deleteNote({ userId, noteId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:noteId/star
// Toggle the starred status of a note
async function toggleStarred(req, res, next) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NOTE_ID',
          message: 'noteId is required',
        },
      });
    }

    // Validate UUID format
    if (!isValidUUID(noteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NOTE_ID',
          message: 'noteId must be a valid UUID',
        },
      });
    }

    const note = await notesRepo.toggleStarred({ userId, noteId });
    res.json(note);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Note not found',
        },
      });
    }
    next(err);
  }
}

// PUT /api/notes/:noteId/star
// Set the starred status of a note to a specific value
async function setStarred(req, res, next) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const { isStarred } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NOTE_ID',
          message: 'noteId is required',
        },
      });
    }

    // Validate UUID format
    if (!isValidUUID(noteId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NOTE_ID',
          message: 'noteId must be a valid UUID',
        },
      });
    }

    if (typeof isStarred !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VALUE',
          message: 'isStarred must be a boolean',
        },
      });
    }

    const note = await notesRepo.setStarred({ userId, noteId, isStarred });
    res.json(note);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Note not found',
        },
      });
    }
    next(err);
  }
}

module.exports = {
  createNote,
  listNotes,
  searchNotes,
  getNote,
  updateNote,
  deleteNote,
  toggleStarred,
  setStarred,
};
