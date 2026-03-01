const { randomUUID } = require('crypto');
const { AppError, NotFoundError, ValidationError } = require('../../errors');
const { logger: baseLogger } = require('../../observability');
const { NOTE_ASSETS_BUCKET } = require('../../config');
const noteAssetsRepository = require('../../repositories/noteAssetsRepository');
const notesRepository = require('../../repositories/notesRepository');
const { createStorageRepository } = require('../../repositories/storageRepository');
const { validateAssetFile } = require('../../utils/assetValidation');

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

function createStorageRepo(deps, bucket) {
  if (deps.storageRepository) {
    return deps.storageRepository;
  }

  return createStorageRepository({
    bucket,
    supabaseClient: deps.supabase,
  });
}

function createServices(deps = {}) {
  const bucket = deps.bucket ?? NOTE_ASSETS_BUCKET;
  const storageRepository = createStorageRepo(deps, bucket);

  return {
    logger: deps.logger ?? baseLogger,
    noteAssetsRepository: deps.noteAssetsRepository ?? noteAssetsRepository,
    notesRepository: deps.notesRepository ?? notesRepository,
    storageRepository,
    bucket,
  };
}

function ensureUserContext(userId) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
}

function ensureNoteId(noteId) {
  if (!noteId) {
    throw new ValidationError('Note ID is required', 'noteId');
  }
}

function ensureAssetId(assetId) {
  if (!assetId) {
    throw new ValidationError('Asset ID is required', 'assetId');
  }
}

async function ensureNoteExists(services, userId, noteId) {
  const note = await services.notesRepository.getNoteForUser({ userId, noteId });
  if (!note) {
    throw new NotFoundError('Note', noteId);
  }
  return note;
}

function resolvePublicUrl(services, storagePath, logContext) {
  const { data: publicUrlData, error: publicUrlError } =
    services.storageRepository.getPublicUrl(storagePath);

  if (publicUrlError) {
    services.logger.warn(
      { err: publicUrlError, ...logContext },
      'Failed to generate public URL for note asset',
    );
  }

  return publicUrlData?.publicUrl || null;
}

async function uploadFileToStorage(services, { storagePath, file, noteId, userId }) {
  const { error: uploadError } = await services.storageRepository.upload(storagePath, file.buffer, {
    contentType: file.mimeType,
    upsert: false,
  });

  if (uploadError) {
    services.logger.error({ err: uploadError, noteId, userId }, 'Failed to upload note asset');
    throw new AppError(
      'Failed to upload file',
      'INTERNAL_ERROR',
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
    );
  }
}

function mapUploadedAsset(asset, url) {
  return { ...asset, url };
}

async function uploadNoteAsset(services, { userId, noteId, file } = {}) {
  ensureUserContext(userId);
  ensureNoteId(noteId);
  await ensureNoteExists(services, userId, noteId);

  const validation = validateAssetFile(file);
  if (!validation.valid) {
    throw new ValidationError(validation.reason || 'Invalid file', 'file');
  }

  const assetId = randomUUID();
  const storagePath = `${userId}/${noteId}/${assetId}.${validation.extension}`;
  await uploadFileToStorage(services, {
    storagePath,
    file: { buffer: file.buffer, mimeType: validation.mimeType },
    noteId,
    userId,
  });

  const asset = await services.noteAssetsRepository.createAsset({
    id: assetId,
    noteId,
    userId,
    type: validation.type,
    mimeType: validation.mimeType,
    storagePath,
  });

  const url = resolvePublicUrl(services, storagePath, { noteId, userId });
  return mapUploadedAsset(asset, url);
}

async function listNoteAssets(services, { userId, noteId } = {}) {
  ensureUserContext(userId);
  ensureNoteId(noteId);
  await ensureNoteExists(services, userId, noteId);

  const assets = await services.noteAssetsRepository.listAssetsForNote(noteId, userId);
  return assets.map((asset) => {
    const url = resolvePublicUrl(services, asset.storage_path, { noteId, userId });
    return { ...asset, url };
  });
}

async function deleteNoteAsset(services, { userId, assetId } = {}) {
  ensureUserContext(userId);
  ensureAssetId(assetId);

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
    throw new AppError(
      'Failed to delete asset',
      'INTERNAL_ERROR',
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
    );
  }

  await services.noteAssetsRepository.deleteAsset(assetId, userId);
}

function createNoteAssetsService(deps = {}) {
  const services = createServices(deps);

  return {
    uploadNoteAsset: (params) => uploadNoteAsset(services, params),
    listNoteAssets: (params) => listNoteAssets(services, params),
    deleteNoteAsset: (params) => deleteNoteAsset(services, params),
  };
}

const noteAssetsService = createNoteAssetsService();

module.exports = {
  createNoteAssetsService,
  noteAssetsService,
};
