// backend/controllers/notes/crud.js

const { notesService } = require('../../services/notes/notesService');
const { extractIdempotencyKey } = require('../../utils/idempotencyKey');
const { FIFTY, TEN } = require('../../constants/numbers');
const HTTP_STATUS = require('../../constants/httpStatus');

/**
 * Notes CRUD controller - Thin HTTP layer
 *
 * Validation handled by middleware (Zod schemas).
 * Business logic delegated to services.
 */

// POST /api/notes
async function createNote(req, res, next) {
  try {
    const userId = req.user?.id;
    const idempotencyKey = extractIdempotencyKey(req);
    const note = await notesService.createNote({ userId, payload: req.body, idempotencyKey });
    res.status(HTTP_STATUS.CREATED).json(note);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes?sourceUrl=&courseCode=&limit=
async function listNotes(req, res, next) {
  try {
    const userId = req.user?.id;
    const { sourceUrl, courseCode, limit } = req.query;
    const notes = await notesService.listNotes({
      userId,
      sourceUrl,
      courseCode,
      limit: limit ? Number(limit) : FIFTY,
    });
    res.json(notes);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/search?q=...&courseCode=
async function searchNotes(req, res, next) {
  try {
    const userId = req.user?.id;
    const { q, courseCode, k } = req.query;
    const matches = await notesService.searchNotes({
      userId,
      query: q,
      courseCode,
      matchCount: k ? Number(k) : TEN,
    });
    res.json(matches);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/:noteId
async function getNote(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    const note = await notesService.getNote({ userId, noteId });
    res.json(note);
  } catch (err) {
    next(err);
  }
}

// PUT /api/notes/:noteId
async function updateNote(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    const ifUnmodifiedSince = req.headers['if-unmodified-since'];

    const note = await notesService.updateNote({
      userId,
      noteId,
      payload: req.body,
      ifUnmodifiedSince: typeof ifUnmodifiedSince === 'string' ? ifUnmodifiedSince : null,
    });

    res.json(note);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notes/:noteId
async function deleteNote(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    await notesService.deleteNote({ userId, noteId });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:noteId/star
async function toggleStarred(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    const note = await notesService.toggleStarred({ userId, noteId });
    res.json(note);
  } catch (err) {
    next(err);
  }
}

// PUT /api/notes/:noteId/star
async function setStarred(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    const { isStarred } = req.body;
    const note = await notesService.setStarred({ userId, noteId, isStarred });
    res.json(note);
  } catch (err) {
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
