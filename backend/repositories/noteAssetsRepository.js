const { supabase } = require('../db/supabaseClient');

async function createAsset({ id, noteId, userId, type, mimeType, storagePath }) {
  const { data, error } = await supabase
    .from('note_assets')
    .insert({
      id,
      note_id: noteId,
      user_id: userId,
      type,
      mime_type: mimeType,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function listAssetsForNote(noteId, userId) {
  const { data, error } = await supabase
    .from('note_assets')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

async function getAssetById(assetId, userId) {
  const { data, error } = await supabase
    .from('note_assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

async function deleteAsset(assetId, userId) {
  const { error } = await supabase
    .from('note_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId);

  if (error) throw error;
}

module.exports = {
  createAsset,
  listAssetsForNote,
  getAssetById,
  deleteAsset,
};
