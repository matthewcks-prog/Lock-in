const { randomUUID } = require('crypto');
const { AppError, NotFoundError, ValidationError } = require('../../errors');
const { logger: baseLogger } = require('../../observability');
const { NOTE_ASSETS_BUCKET } = require('../../config');
const noteAssetsRepository = require('../../repositories/noteAssetsRepository');
const notesRepository = require('../../repositories/notesRepository');
const { createStorageRepository } = require('../../repositories/storageRepository');
const { validateAssetFile } = require('../../utils/assetValidation');

function createNoteAssetsService(deps = {}) {
  const bucket = deps.bucket ?? NOTE_ASSETS_BUCKET;
  const storageRepository =
    deps.storageRepository ??
    createStorageRepository({
      bucket,
      supabaseClient: deps.supabase,
    });
  const services = {
    logger: deps.logger ?? baseLogger,
    noteAssetsRepository: deps.noteAssetsRepository ?? noteAssetsRepository,
    notesRepository: deps.notesRepository ?? notesRepository,
    storageRepository,
    bucket,
  };

  async function ensureNoteExists(userId, noteId) {
    const note = await services.notesRepository.getNoteForUser({ userId, noteId });
    if (!note) {
      throw new NotFoundError('Note', noteId);
    }
    return note;
  }

  async function uploadNoteAsset({ userId, noteId, file } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }
    if (!noteId) {
      throw new ValidationError('Note ID is required', 'noteId');
    }

    await ensureNoteExists(userId, noteId);

    const validation = validateAssetFile(file);
    if (!validation.valid) {
      throw new ValidationError(validation.reason || 'Invalid file', 'file');
    }

    const assetId = randomUUID();
    const storagePath = `${userId}/${noteId}/${assetId}.${validation.extension}`;

    const { error: uploadError } = await services.storageRepository.upload(
      storagePath,
      file.buffer,
      {
        contentType: validation.mimeType,
        upsert: false,
      },
    );

    if (uploadError) {
      services.logger.error({ err: uploadError, noteId, userId }, 'Failed to upload note asset');
      throw new AppError('Failed to upload file', 'INTERNAL_ERROR', 500);
    }

    const asset = await services.noteAssetsRepository.createAsset({
      id: assetId,
      noteId,
      userId,
      type: validation.type,
      mimeType: validation.mimeType,
      storagePath,
    });

    const { data: publicUrlData, error: publicUrlError } =
      services.storageRepository.getPublicUrl(storagePath);

    if (publicUrlError) {
      services.logger.warn(
        { err: publicUrlError, noteId, userId },
        'Failed to generate public URL for note asset',
      );
    }

    return {
      ...asset,
      url: publicUrlData?.publicUrl || null,
    };
  }

  async function listNoteAssets({ userId, noteId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }
    if (!noteId) {
      throw new ValidationError('Note ID is required', 'noteId');
    }

    await ensureNoteExists(userId, noteId);

    const assets = await services.noteAssetsRepository.listAssetsForNote(noteId, userId);

    return assets.map((asset) => {
      const { data } = services.storageRepository.getPublicUrl(asset.storage_path);
      return { ...asset, url: data?.publicUrl || null };
    });
  }

  async function deleteNoteAsset({ userId, assetId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }
    if (!assetId) {
      throw new ValidationError('Asset ID is required', 'assetId');
    }

    const asset = await services.noteAssetsRepository.getAssetById(assetId, userId);
    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    const { error: storageError } = await services.storageRepository.remove([asset.storage_path]);

    if (storageError) {
      services.logger.error(
        { err: storageError, assetId, userId },
        'Failed to delete note asset from storage',
      );
      throw new AppError('Failed to delete asset', 'INTERNAL_ERROR', 500);
    }

    await services.noteAssetsRepository.deleteAsset(assetId, userId);
  }

  return {
    uploadNoteAsset,
    listNoteAssets,
    deleteNoteAsset,
  };
}

const noteAssetsService = createNoteAssetsService();

module.exports = {
  createNoteAssetsService,
  noteAssetsService,
};
