// backend/controllers/notesController.js

const notesRepo = require('../repositories/notesRepository');
const { embedText } = require('../openaiClient');

/**
 * Normalize tags to ensure consistent array format
 * @param {any} tags - Tags input (array, string, or null/undefined)
 * @returns {string[]} Normalized array of tags
 */
function normaliseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
  return [];
}

// POST /api/notes
async function createNote(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      title,
      content,
      sourceSelection,
      sourceUrl,
      courseCode,
      noteType,
      tags,
    } = req.body;

    // Validate required fields
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'content is required and cannot be empty' } 
      });
    }

    // Validate content length (prevent extremely long notes)
    const MAX_CONTENT_LENGTH = 50000; // 50k characters
    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ 
        success: false,
        error: { message: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` } 
      });
    }

    // Generate embedding for semantic search
    let embedding;
    try {
      embedding = await embedText(content);
    } catch (embedError) {
      // Log but don't fail - note can still be saved without embedding
      console.error('Failed to generate embedding:', embedError);
      // Continue without embedding (note will not be searchable via semantic search)
      embedding = null;
    }

    const note = await notesRepo.createNote({
      userId,
      title: title?.trim() || 'Untitled Note',
      content: content.trim(),
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
        error: { message: 'query parameter (q) is required' } 
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
        error: { message: 'Failed to process search query' } 
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

// PUT /api/notes/:noteId
async function updateNote(req, res, next) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const {
      title,
      content,
      sourceSelection,
      sourceUrl,
      courseCode,
      noteType,
      tags,
    } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: { message: 'noteId is required' },
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'content is required and cannot be empty' } 
      });
    }

    let embedding;
    try {
      embedding = await embedText(content);
    } catch (embedError) {
      console.error('Failed to regenerate embedding:', embedError);
      embedding = null;
    }

    const note = await notesRepo.updateNote({
      userId,
      noteId,
      title: title?.trim() || 'Untitled Note',
      content: content.trim(),
      sourceSelection: sourceSelection?.trim() || null,
      sourceUrl: sourceUrl?.trim() || null,
      courseCode: courseCode?.trim() || null,
      noteType: noteType || 'manual',
      tags: normaliseTags(tags),
      embedding,
    });

    res.json(note);
  } catch (err) {
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

    await notesRepo.deleteNote({ userId, noteId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createNote,
  listNotes,
  searchNotes,
  updateNote,
  deleteNote,
};

