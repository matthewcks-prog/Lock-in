const { randomUUID } = require('crypto');
const { supabase } = require('../supabaseClient');
const { NOTE_ASSETS_BUCKET } = require('../config');
const noteAssetsRepository = require('../repositories/noteAssetsRepository');
const notesRepository = require('../repositories/notesRepository');
const { validateAssetFile } = require('../utils/assetValidation');

// POST /api/notes/:noteId/assets
async function uploadNoteAsset(req, res) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const file = req.file;

    // Verify note ownership
    const note = await notesRepository.getNoteForUser({ userId, noteId });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Validate file and derive type/extension
    const validation = validateAssetFile(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const assetId = randomUUID();
    const storagePath = `${userId}/${noteId}/${assetId}.${validation.extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(NOTE_ASSETS_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: validation.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload asset to storage:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Persist DB record
    const asset = await noteAssetsRepository.createAsset({
      id: assetId,
      noteId,
      userId,
      type: validation.type,
      mimeType: validation.mimeType,
      storagePath,
    });

    const { data: publicUrlData, error: publicUrlError } = supabase.storage
      .from(NOTE_ASSETS_BUCKET)
      .getPublicUrl(storagePath);

    if (publicUrlError) {
      console.warn('Failed to generate public URL for asset:', publicUrlError);
    }

    const url = publicUrlData?.publicUrl || null;

    return res.status(201).json({
      ...asset,
      url,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unexpected error uploading asset' });
  }
}

// GET /api/notes/:noteId/assets
async function listNoteAssets(req, res) {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;

    // Ensure note exists and belongs to user
    const note = await notesRepository.getNoteForUser({ userId, noteId });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const assets = await noteAssetsRepository.listAssetsForNote(noteId, userId);

    const assetsWithUrls = assets.map((asset) => {
      const { data } = supabase.storage.from(NOTE_ASSETS_BUCKET).getPublicUrl(asset.storage_path);
      return { ...asset, url: data?.publicUrl || null };
    });

    res.json(assetsWithUrls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list assets' });
  }
}

// DELETE /api/note-assets/:assetId
async function deleteNoteAsset(req, res) {
  try {
    const userId = req.user.id;
    const { assetId } = req.params;

    const asset = await noteAssetsRepository.getAssetById(assetId, userId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { error: storageError } = await supabase.storage
      .from(NOTE_ASSETS_BUCKET)
      .remove([asset.storage_path]);

    if (storageError) {
      console.error('Failed to delete asset from storage:', storageError);
      return res.status(500).json({ error: 'Failed to delete asset' });
    }

    await noteAssetsRepository.deleteAsset(assetId, userId);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
}

module.exports = {
  uploadNoteAsset,
  listNoteAssets,
  deleteNoteAsset,
};
