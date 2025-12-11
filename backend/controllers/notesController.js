// backend/controllers/notesController.js

const notesRepo = require("../repositories/notesRepository");
const { embedText } = require("../openaiClient");
const { extractPlainTextFromLexical } = require("../utils/lexicalUtils");

/**
 * Normalize tags to ensure consistent array format
 * @param {any} tags - Tags input (array, string, or null/undefined)
 * @returns {string[]} Normalized array of tags
 */
function normaliseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.filter(
      (tag) => typeof tag === "string" && tag.trim().length > 0
    );
  }
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return [];
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
      sourceSelection,
      sourceUrl,
      courseCode,
      noteType,
      tags,
    } = req.body;

    // Debug logging
    console.log("createNote request body keys:", Object.keys(req.body));
    console.log("content_json type:", typeof content_json);
    console.log("editor_version:", editor_version);

    // Determine which content format we're using
    const hasLexicalContent = content_json && editor_version;
    const hasLegacyContent =
      content && typeof content === "string" && content.trim().length > 0;

    if (!hasLexicalContent && !hasLegacyContent) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            "content_json and editor_version are required, or legacy content field must be provided",
        },
      });
    }

    // Ensure content_json is always an object (required by database)
    let finalContentJson = {};
    let finalEditorVersion = "lexical_v1";

    if (hasLexicalContent) {
      // Validate content_json is an object
      if (typeof content_json === "string") {
        try {
          finalContentJson = JSON.parse(content_json);
        } catch {
          return res.status(400).json({
            success: false,
            error: { message: "content_json must be a valid JSON object" },
          });
        }
      } else if (typeof content_json === "object" && content_json !== null) {
        finalContentJson = content_json;
      } else {
        return res.status(400).json({
          success: false,
          error: { message: "content_json must be a valid JSON object" },
        });
      }
      finalEditorVersion = editor_version;
    }

    // Extract plain text for embedding
    let plainText = "";
    if (hasLexicalContent) {
      // Use provided content_text or extract from Lexical JSON
      plainText =
        content_text || extractPlainTextFromLexical(finalContentJson) || "";
    } else {
      // Legacy: use content field (strip HTML if present)
      plainText = content.trim();
      // Basic HTML stripping for legacy content
      plainText = plainText
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (!plainText || plainText.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: "Note content cannot be empty" },
      });
    }

    // Validate content length (prevent extremely long notes)
    const MAX_CONTENT_LENGTH = 50000; // 50k characters
    if (plainText.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
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
      console.error("Failed to generate embedding:", embedError);
      // Continue without embedding (note will not be searchable via semantic search)
      embedding = null;
    }

    const note = await notesRepo.createNote({
      userId,
      title: title?.trim() || "Untitled Note",
      contentJson: finalContentJson,
      editorVersion: finalEditorVersion,
      contentPlain: plainText,
      legacyContent: hasLegacyContent ? content.trim() : null,
      sourceSelection: sourceSelection?.trim() || null,
      sourceUrl: sourceUrl?.trim() || null,
      courseCode: courseCode?.trim() || null,
      noteType: noteType || "manual",
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
    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: "query parameter (q) is required" },
      });
    }

    // Validate and limit k parameter
    const matchCount = k ? Math.min(Math.max(parseInt(k, 10), 1), 50) : 10; // Between 1 and 50

    // Generate embedding for search query
    let queryEmbedding;
    try {
      queryEmbedding = await embedText(q.trim());
    } catch (embedError) {
      console.error("Failed to generate query embedding:", embedError);
      return res.status(500).json({
        success: false,
        error: { message: "Failed to process search query" },
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
        error: { message: "noteId is required" },
      });
    }

    const note = await notesRepo.getNoteForUser({ userId, noteId });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: { message: "Note not found" },
      });
    }

    res.json(note);
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
        error: { message: "noteId is required" },
      });
    }

    // Determine which content format we're using
    const hasLexicalContent = content_json && editor_version;
    const hasLegacyContent =
      content && typeof content === "string" && content.trim().length > 0;

    if (!hasLexicalContent && !hasLegacyContent) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            "content_json and editor_version are required, or legacy content field must be provided",
        },
      });
    }

    // Ensure content_json is always an object (required by database)
    let finalContentJson = {};
    let finalEditorVersion = "lexical_v1";

    if (hasLexicalContent) {
      // Validate content_json is an object
      if (typeof content_json === "string") {
        try {
          finalContentJson = JSON.parse(content_json);
        } catch {
          return res.status(400).json({
            success: false,
            error: { message: "content_json must be a valid JSON object" },
          });
        }
      } else if (typeof content_json === "object" && content_json !== null) {
        finalContentJson = content_json;
      } else {
        return res.status(400).json({
          success: false,
          error: { message: "content_json must be a valid JSON object" },
        });
      }
      finalEditorVersion = editor_version;
    }

    // Extract plain text for embedding
    let plainText = "";
    if (hasLexicalContent) {
      // Use provided content_text or extract from Lexical JSON
      plainText =
        content_text || extractPlainTextFromLexical(finalContentJson) || "";
    } else {
      // Legacy: use content field (strip HTML if present)
      plainText = content.trim();
      // Basic HTML stripping for legacy content
      plainText = plainText
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (!plainText || plainText.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: "Note content cannot be empty" },
      });
    }

    let embedding;
    try {
      embedding = await embedText(plainText);
    } catch (embedError) {
      console.error("Failed to regenerate embedding:", embedError);
      embedding = null;
    }

    const note = await notesRepo.updateNote({
      userId,
      noteId,
      title: title?.trim() || "Untitled Note",
      contentJson: finalContentJson,
      editorVersion: finalEditorVersion,
      contentPlain: plainText,
      legacyContent: hasLegacyContent ? content.trim() : null,
      sourceSelection: sourceSelection?.trim() || null,
      sourceUrl: sourceUrl?.trim() || null,
      courseCode: courseCode?.trim() || null,
      noteType: noteType || "manual",
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
        error: { message: "noteId is required" },
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
  getNote,
  updateNote,
  deleteNote,
};
