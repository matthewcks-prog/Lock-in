// backend/controllers/notesController.js

const notesRepo = require('../repositories/notesRepository');
const { embedText } = require('../openaiClient');

function normaliseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return [tags];
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

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    // generate embedding
    const embedding = await embedText(content);

    const note = await notesRepo.createNote({
      userId,
      title,
      content,
      sourceSelection,
      sourceUrl,
      courseCode,
      noteType,
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

    const notes = await notesRepo.listNotes({
      userId,
      sourceUrl,
      courseCode,
      limit: limit ? parseInt(limit, 10) : 50,
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

    if (!q) return res.status(400).json({ error: 'q is required' });

    const queryEmbedding = await embedText(q);

    let matches = await notesRepo.searchNotesByEmbedding({
      userId,
      queryEmbedding,
      matchCount: k ? parseInt(k, 10) : 10,
    });

    // optional filter by course on app side
    if (courseCode) {
      matches = matches.filter((n) => n.course_code === courseCode);
    }

    res.json(matches);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createNote,
  listNotes,
  searchNotes,
};

