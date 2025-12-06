// backend/repositories/notesRepository.js

const { supabase } = require('../supabaseClient');

async function createNote({ userId, title, content, sourceSelection, sourceUrl, courseCode, noteType, tags, embedding }) {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      title,
      content,
      source_selection: sourceSelection,
      source_url: sourceUrl,
      course_code: courseCode,
      note_type: noteType,
      tags,
      embedding,
    })
    .select()
    .single();

  if (error) throw error;
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

async function updateNote({ userId, noteId, title, content, sourceSelection, sourceUrl, courseCode, noteType, tags, embedding }) {
  const { data, error } = await supabase
    .from('notes')
    .update({
      title,
      content,
      source_selection: sourceSelection,
      source_url: sourceUrl,
      course_code: courseCode,
      note_type: noteType,
      tags,
      embedding,
    })
    .eq('id', noteId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
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

module.exports = {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  searchNotesByEmbedding,
};

