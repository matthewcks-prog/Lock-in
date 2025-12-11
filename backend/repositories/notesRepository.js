// backend/repositories/notesRepository.js

const { supabase } = require("../supabaseClient");

/**
 * Repository for notes CRUD operations.
 *
 * Scalability features:
 * - Optimistic locking via updated_at for conflict detection
 * - Proper indexing recommendations in DATABASE.md
 * - Efficient queries with proper filtering
 */

/**
 * Custom error for concurrent modification conflicts
 */
class ConflictError extends Error {
  constructor(message, currentUpdatedAt) {
    super(message);
    this.name = "ConflictError";
    this.status = 409;
    this.updatedAt = currentUpdatedAt;
  }
}

async function createNote({
  userId,
  title,
  contentJson,
  editorVersion,
  contentPlain,
  legacyContent,
  sourceSelection,
  sourceUrl,
  courseCode,
  noteType,
  tags,
  embedding,
}) {
  const insertData = {
    user_id: userId,
    title,
    content_json: contentJson || {}, // Ensure we always provide content_json (defaults to {} in DB but safer to be explicit)
    editor_version: editorVersion || "lexical_v1",
    content_plain: contentPlain || legacyContent || null, // Plain text content for search/display
    source_selection: sourceSelection,
    source_url: sourceUrl,
    course_code: courseCode,
    note_type: noteType,
    tags,
    embedding,
  };

  const { data, error } = await supabase
    .from("notes")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    throw error;
  }
  return data;
}

async function listNotes({ userId, sourceUrl, courseCode, limit = 50 }) {
  let query = supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceUrl) query = query.eq("source_url", sourceUrl);
  if (courseCode) query = query.eq("course_code", courseCode);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Update a note with optimistic locking support.
 *
 * @param {Object} params - Update parameters
 * @param {string} params.userId - User ID
 * @param {string} params.noteId - Note ID
 * @param {string} [params.ifUnmodifiedSince] - ISO timestamp for optimistic locking
 * @returns {Promise<Object>} Updated note
 * @throws {ConflictError} If note was modified since ifUnmodifiedSince
 */
async function updateNote({
  userId,
  noteId,
  title,
  contentJson,
  editorVersion,
  contentPlain,
  legacyContent,
  sourceSelection,
  sourceUrl,
  courseCode,
  noteType,
  tags,
  embedding,
  ifUnmodifiedSince,
}) {
  // If optimistic locking is requested, first check the current version
  if (ifUnmodifiedSince) {
    const { data: currentNote, error: fetchError } = await supabase
      .from("notes")
      .select("updated_at")
      .eq("id", noteId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        const error = new Error("Note not found");
        error.status = 404;
        throw error;
      }
      throw fetchError;
    }

    // Compare timestamps - if server version is newer, reject the update
    const serverTime = new Date(currentNote.updated_at).getTime();
    const clientTime = new Date(ifUnmodifiedSince).getTime();

    if (serverTime > clientTime) {
      throw new ConflictError(
        "Note was modified by another session. Please refresh and try again.",
        currentNote.updated_at
      );
    }
  }

  const updateData = {
    title,
    content_json: contentJson || {}, // Ensure we always provide content_json
    editor_version: editorVersion || "lexical_v1",
    content_plain: contentPlain || legacyContent || null, // Plain text content for search/display
    source_selection: sourceSelection,
    source_url: sourceUrl,
    course_code: courseCode,
    note_type: noteType,
    tags,
    embedding,
    updated_at: new Date().toISOString(), // Explicitly set updated_at for optimistic locking
  };

  const { data, error } = await supabase
    .from("notes")
    .update(updateData)
    .eq("id", noteId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating note:", error);
    if (error.code === "PGRST116") {
      const notFoundError = new Error("Note not found");
      notFoundError.status = 404;
      throw notFoundError;
    }
    throw error;
  }
  return data;
}

async function deleteNote({ userId, noteId }) {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function searchNotesByEmbedding({
  userId,
  queryEmbedding,
  matchCount = 10,
}) {
  const { data, error } = await supabase.rpc("match_notes", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    in_user_id: userId,
  });

  if (error) throw error;
  return data;
}

async function getNoteForUser({ userId, noteId }) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("user_id", userId)
    .single();

  if (error) {
    // PGRST116 = no rows found
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

module.exports = {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  searchNotesByEmbedding,
  getNoteForUser,
  ConflictError,
};
