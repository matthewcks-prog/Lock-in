const { AppError, ConflictError, NotFoundError, ValidationError } = require('../../errors');
const { logger: baseLogger } = require('../../observability');
const notesRepo = require('../../repositories/notesRepository');
const noteAssetsRepository = require('../../repositories/noteAssetsRepository');
const contentService = require('./contentService');
const { createIdempotencyStore } = require('../../utils/idempotency');
const { NOTE_ASSETS_BUCKET } = require('../../config');
const { createStorageRepository } = require('../../repositories/storageRepository');
const {
  normalizeOptionalString,
  prepareContent,
  buildCreateMetadata,
  buildUpdateMetadata,
} = require('./notesServiceHelpers');

const defaultIdempotencyStore = createIdempotencyStore();
const LIST_NOTES_DEFAULT_LIMIT = 50;
const SEARCH_MATCH_DEFAULT_COUNT = 10;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_NOT_FOUND = 404;

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
    notesRepo: deps.notesRepo ?? notesRepo,
    noteAssetsRepository: deps.noteAssetsRepository ?? noteAssetsRepository,
    contentService: deps.contentService ?? contentService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
    logger: deps.logger ?? baseLogger,
    storageRepository,
    bucket,
  };
}

function ensureUserContext(userId) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
}

function buildCreateNoteInput({ userId, processed, metadata, embedding }) {
  return {
    userId,
    clientNoteId: metadata.clientNoteId,
    title: metadata.title,
    contentJson: processed.contentJson,
    editorVersion: processed.editorVersion,
    contentPlain: processed.plainText,
    legacyContent: processed.legacyContent,
    sourceSelection: metadata.sourceSelection,
    sourceUrl: metadata.sourceUrl,
    courseCode: metadata.courseCode,
    noteType: metadata.noteType,
    tags: metadata.tags,
    embedding,
  };
}

async function createNote(services, { userId, payload, idempotencyKey } = {}) {
  ensureUserContext(userId);

  const { processed, embedding } = await prepareContent(payload, services);
  const metadata = buildCreateMetadata(payload, services);
  const noteData = buildCreateNoteInput({ userId, processed, metadata, embedding });
  const runCreate = () => services.notesRepo.createNote(noteData);

  if (idempotencyKey) {
    return services.idempotencyStore.run(idempotencyKey, userId, runCreate);
  }

  return runCreate();
}

async function listNotes(
  services,
  { userId, sourceUrl, courseCode, limit = LIST_NOTES_DEFAULT_LIMIT } = {},
) {
  ensureUserContext(userId);

  return services.notesRepo.listNotes({
    userId,
    sourceUrl: normalizeOptionalString(sourceUrl) || undefined,
    courseCode: normalizeOptionalString(courseCode) || undefined,
    limit,
  });
}

function ensureSearchQuery(query) {
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  if (!trimmedQuery) {
    throw new ValidationError('Query parameter (q) is required');
  }
  return trimmedQuery;
}

async function searchNotes(
  services,
  { userId, query, courseCode, matchCount = SEARCH_MATCH_DEFAULT_COUNT } = {},
) {
  ensureUserContext(userId);
  const trimmedQuery = ensureSearchQuery(query);

  const queryEmbedding = await services.contentService.generateEmbeddingForNote(trimmedQuery);
  if (!queryEmbedding) {
    throw new AppError(
      'Failed to process search query',
      'INTERNAL_ERROR',
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
    );
  }

  let matches = await services.notesRepo.searchNotesByEmbedding({
    userId,
    queryEmbedding,
    matchCount,
  });

  const normalizedCourse = normalizeOptionalString(courseCode);
  if (normalizedCourse) {
    matches = matches.filter((note) => note.course_code === normalizedCourse);
  }

  return matches;
}

async function getNote(services, { userId, noteId } = {}) {
  ensureUserContext(userId);

  const note = await services.notesRepo.getNoteForUser({ userId, noteId });
  if (!note) {
    throw new NotFoundError('Note', noteId);
  }

  return note;
}

function buildUpdateNoteInput({
  userId,
  noteId,
  processed,
  metadata,
  embedding,
  ifUnmodifiedSince,
}) {
  return {
    userId,
    noteId,
    title: metadata.title,
    contentJson: processed.contentJson,
    editorVersion: processed.editorVersion,
    contentPlain: processed.plainText,
    legacyContent: processed.legacyContent,
    sourceSelection: metadata.sourceSelection,
    sourceUrl: metadata.sourceUrl,
    courseCode: metadata.courseCode,
    noteType: metadata.noteType,
    tags: metadata.tags,
    embedding,
    ifUnmodifiedSince: ifUnmodifiedSince || null,
  };
}

function remapUpdateError(error, noteId) {
  if (error?.name === 'ConflictError') {
    return new ConflictError(
      error.message || 'Note was modified by another session.',
      error.updatedAt || null,
    );
  }

  if (error?.status === HTTP_STATUS_NOT_FOUND) {
    return new NotFoundError('Note', noteId);
  }

  return error;
}

async function updateNote(services, { userId, noteId, payload, ifUnmodifiedSince } = {}) {
  ensureUserContext(userId);

  const { processed, embedding } = await prepareContent(payload, services);
  const metadata = buildUpdateMetadata(payload, services);

  try {
    const updateInput = buildUpdateNoteInput({
      userId,
      noteId,
      processed,
      metadata,
      embedding,
      ifUnmodifiedSince,
    });
    return await services.notesRepo.updateNote(updateInput);
  } catch (error) {
    const remappedError = remapUpdateError(error, noteId);
    if (remappedError === error) {
      services.logger.error({ err: error, noteId, userId }, 'Failed to update note');
    }
    throw remappedError;
  }
}

async function cleanupNoteAssets(services, noteId, userId) {
  try {
    const assets = await services.noteAssetsRepository.listAssetsForNote(noteId, userId);
    if (!assets || assets.length === 0) {
      return;
    }

    const storagePaths = assets.map((asset) => asset.storage_path);
    const { error: storageError } = await services.storageRepository.remove(storagePaths);
    if (storageError) {
      services.logger.warn(
        { err: storageError, noteId, userId },
        'Failed to delete note asset files from storage',
      );
    }
  } catch (error) {
    services.logger.warn(
      { err: error, noteId, userId },
      'Failed to clean up note assets before deletion',
    );
  }
}

async function deleteNote(services, { userId, noteId } = {}) {
  ensureUserContext(userId);
  await cleanupNoteAssets(services, noteId, userId);
  await services.notesRepo.deleteNote({ userId, noteId });
}

function remapNotFoundRepoError(error, entityName, entityId) {
  if (error?.status === HTTP_STATUS_NOT_FOUND) {
    return new NotFoundError(entityName, entityId);
  }
  return error;
}

async function toggleStarred(services, { userId, noteId } = {}) {
  ensureUserContext(userId);

  try {
    return await services.notesRepo.toggleStarred({ userId, noteId });
  } catch (error) {
    throw remapNotFoundRepoError(error, 'Note', noteId);
  }
}

async function setStarred(services, { userId, noteId, isStarred } = {}) {
  ensureUserContext(userId);

  try {
    return await services.notesRepo.setStarred({ userId, noteId, isStarred });
  } catch (error) {
    throw remapNotFoundRepoError(error, 'Note', noteId);
  }
}

function createNotesService(deps = {}) {
  const services = createServices(deps);

  return {
    createNote: (params) => createNote(services, params),
    listNotes: (params) => listNotes(services, params),
    searchNotes: (params) => searchNotes(services, params),
    getNote: (params) => getNote(services, params),
    updateNote: (params) => updateNote(services, params),
    deleteNote: (params) => deleteNote(services, params),
    toggleStarred: (params) => toggleStarred(services, params),
    setStarred: (params) => setStarred(services, params),
  };
}

const notesService = createNotesService();

module.exports = {
  createNotesService,
  notesService,
};
