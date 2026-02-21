// backend/repositories/notesRepository.js

const { supabase } = require('../db/supabaseClient');

const DEFAULT_EDITOR_VERSION = 'lexical_v1';
const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_MATCH_COUNT = 10;
const STATUS_NOT_FOUND = 404;
const SUPABASE_NO_ROWS_CODE = 'PGRST116';
const SUPABASE_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Repository for notes CRUD operations.
 *
 * Scalability features:
 * - Optimistic locking via updated_at for conflict detection
 * - Proper indexing recommendations in docs/reference/DATABASE.md
 * - Efficient queries with proper filtering
 */

/**
 * Custom error for concurrent modification conflicts
 */
class ConflictError extends Error {
  constructor(message, currentUpdatedAt) {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
    this.updatedAt = currentUpdatedAt;
  }
}

function createNotFoundError(message = 'Note not found') {
  const error = new Error(message);
  error.status = STATUS_NOT_FOUND;
  return error;
}

function isNoRowsFoundError(error) {
  return error?.code === SUPABASE_NO_ROWS_CODE;
}

function buildContentPayload({ contentJson, editorVersion, contentPlain, legacyContent }) {
  return {
    content_json: contentJson || {},
    editor_version: editorVersion || DEFAULT_EDITOR_VERSION,
    content_plain: contentPlain || legacyContent || null,
  };
}

function buildCreateInsertData(params) {
  const {
    userId,
    clientNoteId,
    title,
    sourceSelection,
    sourceUrl,
    courseCode,
    week,
    noteType,
    tags,
    embedding,
  } = params;

  return {
    ...(clientNoteId ? { id: clientNoteId } : {}),
    user_id: userId,
    title,
    ...buildContentPayload(params),
    source_selection: sourceSelection,
    source_url: sourceUrl,
    course_code: courseCode,
    week: week ?? null,
    note_type: noteType,
    tags,
    embedding,
  };
}

function buildUpdateData(params) {
  const { title, sourceSelection, sourceUrl, courseCode, week, noteType, tags, embedding } = params;

  return {
    title,
    ...buildContentPayload(params),
    source_selection: sourceSelection,
    source_url: sourceUrl,
    course_code: courseCode,
    week: week ?? null,
    note_type: noteType,
    tags,
    embedding,
    updated_at: new Date().toISOString(),
  };
}

async function fetchCurrentUpdatedAt(userId, noteId) {
  const { data: currentNote, error } = await supabase
    .from('notes')
    .select('updated_at')
    .eq('id', noteId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (isNoRowsFoundError(error)) {
      throw createNotFoundError();
    }
    throw error;
  }

  return currentNote.updated_at;
}

async function handleDuplicateClientNote(params) {
  const { clientNoteId, userId } = params;
  if (!clientNoteId) {
    return null;
  }

  const existing = await getNoteForUser({
    userId,
    noteId: clientNoteId,
  });
  if (!existing) {
    return null;
  }

  return updateNote({
    ...params,
    noteId: clientNoteId,
    ifUnmodifiedSince: null,
  });
}

async function createNote(params) {
  const insertData = buildCreateInsertData(params);
  const { data, error } = await supabase.from('notes').insert(insertData).select().single();

  if (!error) {
    return data;
  }

  if (params.clientNoteId && error.code === SUPABASE_UNIQUE_VIOLATION_CODE) {
    const duplicateResult = await handleDuplicateClientNote(params);
    if (duplicateResult) {
      return duplicateResult;
    }
  }

  console.error('Error creating note:', error);
  throw error;
}

async function listNotes({ userId, sourceUrl, courseCode, limit = DEFAULT_LIST_LIMIT }) {
  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sourceUrl) {
    query = query.eq('source_url', sourceUrl);
  }
  if (courseCode) {
    query = query.eq('course_code', courseCode);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
}

async function resolveUpdateNoRows(userId, noteId, ifUnmodifiedSince) {
  if (!ifUnmodifiedSince) {
    throw createNotFoundError();
  }

  const currentUpdatedAt = await fetchCurrentUpdatedAt(userId, noteId);
  throw new ConflictError(
    'Note was modified by another session. Please refresh and try again.',
    currentUpdatedAt,
  );
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
async function updateNote(params) {
  const { userId, noteId, ifUnmodifiedSince } = params;
  const updateData = buildUpdateData(params);

  let query = supabase.from('notes').update(updateData).eq('id', noteId).eq('user_id', userId);
  if (ifUnmodifiedSince) {
    query = query.eq('updated_at', ifUnmodifiedSince);
  }

  const { data, error } = await query.select().single();
  if (!error) {
    return data;
  }

  console.error('Error updating note:', error);
  if (isNoRowsFoundError(error)) {
    await resolveUpdateNoRows(userId, noteId, ifUnmodifiedSince);
  }

  throw error;
}

async function deleteNote({ userId, noteId }) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId);
  if (error) {
    throw error;
  }
}

async function searchNotesByEmbedding({
  userId,
  queryEmbedding,
  matchCount = DEFAULT_MATCH_COUNT,
}) {
  const { data, error } = await supabase.rpc('match_notes', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    in_user_id: userId,
  });

  if (error) {
    throw error;
  }
  return data;
}

async function getNoteForUser({ userId, noteId }) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (isNoRowsFoundError(error)) {
      return null;
    }
    throw error;
  }

  return data;
}

async function updateStarredValue({ userId, noteId, isStarred }) {
  const { data, error } = await supabase
    .from('notes')
    .update({ is_starred: isStarred, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    if (isNoRowsFoundError(error)) {
      throw createNotFoundError();
    }
    throw error;
  }

  return data;
}

/**
 * Toggle the starred status of a note.
 * Returns the updated note with the new is_starred value.
 */
async function toggleStarred({ userId, noteId }) {
  const { data: currentNote, error: fetchError } = await supabase
    .from('notes')
    .select('is_starred')
    .eq('id', noteId)
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    if (isNoRowsFoundError(fetchError)) {
      throw createNotFoundError();
    }
    throw fetchError;
  }

  const newValue = !currentNote.is_starred;
  try {
    return await updateStarredValue({ userId, noteId, isStarred: newValue });
  } catch (error) {
    console.error('Error toggling starred:', error);
    throw error;
  }
}

/**
 * Set the starred status of a note to a specific value.
 */
async function setStarred({ userId, noteId, isStarred }) {
  try {
    return await updateStarredValue({ userId, noteId, isStarred });
  } catch (error) {
    if (error.status === STATUS_NOT_FOUND) {
      throw error;
    }
    console.error('Error setting starred:', error);
    throw error;
  }
}

module.exports = {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  searchNotesByEmbedding,
  getNoteForUser,
  toggleStarred,
  setStarred,
  ConflictError,
};
