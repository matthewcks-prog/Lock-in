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

function createNotesService(deps = {}) {
  const bucket = deps.bucket ?? NOTE_ASSETS_BUCKET;
  const storageRepository =
    deps.storageRepository ??
    createStorageRepository({
      bucket,
      supabaseClient: deps.supabase,
    });
  const services = {
    notesRepo: deps.notesRepo ?? notesRepo,
    noteAssetsRepository: deps.noteAssetsRepository ?? noteAssetsRepository,
    contentService: deps.contentService ?? contentService,
    idempotencyStore: deps.idempotencyStore ?? defaultIdempotencyStore,
    logger: deps.logger ?? baseLogger,
    storageRepository,
    bucket,
  };

  async function createNote({ userId, payload, idempotencyKey } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    const { processed, embedding } = await prepareContent(payload, services);
    const metadata = buildCreateMetadata(payload, services);

    const noteData = {
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

    const runCreate = () => services.notesRepo.createNote(noteData);

    if (idempotencyKey) {
      return services.idempotencyStore.run(idempotencyKey, userId, runCreate);
    }

    return runCreate();
  }

  async function listNotes({ userId, sourceUrl, courseCode, limit = 50 } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    return services.notesRepo.listNotes({
      userId,
      sourceUrl: normalizeOptionalString(sourceUrl) || undefined,
      courseCode: normalizeOptionalString(courseCode) || undefined,
      limit,
    });
  }

  async function searchNotes({ userId, query, courseCode, matchCount = 10 } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    const trimmedQuery = typeof query === 'string' ? query.trim() : '';
    if (!trimmedQuery) {
      throw new ValidationError('Query parameter (q) is required');
    }

    const queryEmbedding = await services.contentService.generateEmbeddingForNote(trimmedQuery);
    if (!queryEmbedding) {
      throw new AppError('Failed to process search query', 'INTERNAL_ERROR', 500);
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

  async function getNote({ userId, noteId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    const note = await services.notesRepo.getNoteForUser({ userId, noteId });
    if (!note) {
      throw new NotFoundError('Note', noteId);
    }

    return note;
  }

  async function updateNote({ userId, noteId, payload, ifUnmodifiedSince } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    const { processed, embedding } = await prepareContent(payload, services);
    const metadata = buildUpdateMetadata(payload, services);

    try {
      return await services.notesRepo.updateNote({
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
      });
    } catch (error) {
      if (error?.name === 'ConflictError') {
        throw new ConflictError(
          error.message || 'Note was modified by another session.',
          error.updatedAt || null,
        );
      }

      if (error?.status === 404) {
        throw new NotFoundError('Note', noteId);
      }

      services.logger.error({ err: error, noteId, userId }, 'Failed to update note');
      throw error;
    }
  }

  async function deleteNote({ userId, noteId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    try {
      const assets = await services.noteAssetsRepository.listAssetsForNote(noteId, userId);
      if (assets && assets.length > 0) {
        const storagePaths = assets.map((asset) => asset.storage_path);
        const { error: storageError } = await services.storageRepository.remove(storagePaths);

        if (storageError) {
          services.logger.warn(
            { err: storageError, noteId, userId },
            'Failed to delete note asset files from storage',
          );
        }
      }
    } catch (error) {
      services.logger.warn(
        { err: error, noteId, userId },
        'Failed to clean up note assets before deletion',
      );
    }

    await services.notesRepo.deleteNote({ userId, noteId });
  }

  async function toggleStarred({ userId, noteId } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    try {
      return await services.notesRepo.toggleStarred({ userId, noteId });
    } catch (error) {
      if (error?.status === 404) {
        throw new NotFoundError('Note', noteId);
      }
      throw error;
    }
  }

  async function setStarred({ userId, noteId, isStarred } = {}) {
    if (!userId) {
      throw new ValidationError('User context missing');
    }

    try {
      return await services.notesRepo.setStarred({ userId, noteId, isStarred });
    } catch (error) {
      if (error?.status === 404) {
        throw new NotFoundError('Note', noteId);
      }
      throw error;
    }
  }

  return {
    createNote,
    listNotes,
    searchNotes,
    getNote,
    updateNote,
    deleteNote,
    toggleStarred,
    setStarred,
  };
}

const notesService = createNotesService();

module.exports = {
  createNotesService,
  notesService,
};
