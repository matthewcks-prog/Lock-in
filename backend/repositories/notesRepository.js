// backend/repositories/notesRepository.js

const { supabase } = require('../supabaseClient');

async function createNote({ userId, title, contentJson, editorVersion, contentPlain, legacyContent, sourceSelection, sourceUrl, courseCode, noteType, tags, embedding }) {
  const insertData = {
    user_id: userId,
    title,
    content_json: contentJson || {}, // Ensure we always provide content_json (defaults to {} in DB but safer to be explicit)
    editor_version: editorVersion || 'lexical_v1',
    content_plain: contentPlain || legacyContent || null, // Plain text content for search/display
    source_selection: sourceSelection,
    source_url: sourceUrl,
    course_code: courseCode,
    note_type: noteType,
    tags,
    embedding,
  };

  const { data, error } = await supabase
    .from('notes')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }
  return data;
}

async function listNotes({ userId, sourceUrl, courseCode, limit = 50 }) {
  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sourceUrl) query = query.eq('source_url', sourceUrl);
  if (courseCode) query = query.eq('course_code', courseCode);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function updateNote({ userId, noteId, title, contentJson, editorVersion, contentPlain, legacyContent, sourceSelection, sourceUrl, courseCode, noteType, tags, embedding }) {
  const updateData = {
    title,
    content_json: contentJson || {}, // Ensure we always provide content_json
    editor_version: editorVersion || 'lexical_v1',
    content_plain: contentPlain || legacyContent || null, // Plain text content for search/display
    source_selection: sourceSelection,
    source_url: sourceUrl,
    course_code: courseCode,
    note_type: noteType,
    tags,
    embedding,
  };

  const { data, error } = await supabase
    .from('notes')
    .update(updateData)
    .eq('id', noteId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }
  return data;
}

async function deleteNote({ userId, noteId }) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId);

  if (error) throw error;
}

async function searchNotesByEmbedding({ userId, queryEmbedding, matchCount = 10 }) {
  const { data, error } = await supabase.rpc('match_notes', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    in_user_id: userId,
  });

  if (error) throw error;
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
    // PGRST116 = no rows found
    if (error.code === 'PGRST116') return null;
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
};

