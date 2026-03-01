import type { Note, NoteAsset } from '../domain/Note.ts';
import { AppError, ErrorCodes } from '../errors';
import { createLogger } from '../utils/logger';
import { toDomainNote } from './notes/noteContent';
import {
  buildCreatePayload,
  buildListParams,
  buildUpdatePayload,
  buildUpdateRequestOptions,
  hasContentJson,
  isRecord,
  migrateLegacyNote,
} from './notes/notesServiceHelpers';
import type {
  CreateNoteInput,
  NoteRequestOptions,
  NotesApiClient,
  NotesService,
  NotesServiceDependencies,
  UpdateNoteInput,
} from './notes/notesServiceTypes';

function ensureService(
  apiClient: NotesApiClient | null | undefined,
): asserts apiClient is NotesApiClient {
  if (apiClient === null || apiClient === undefined) {
    throw new Error('Notes service requires an ApiClient instance');
  }
}

function buildListNotes(apiClient: NotesApiClient | null | undefined): NotesService['listNotes'] {
  return async (params = {}): Promise<Note[]> => {
    ensureService(apiClient);
    const rawNotes = await apiClient.listNotes(buildListParams(params));
    if (!Array.isArray(rawNotes)) return [];

    return Promise.all(
      rawNotes.map(async (raw) =>
        hasContentJson(raw) ? toDomainNote(raw) : migrateLegacyNote(raw, apiClient),
      ),
    );
  };
}

function buildGetNote(apiClient: NotesApiClient | null | undefined): NotesService['getNote'] {
  return async (noteId: string): Promise<Note> => {
    ensureService(apiClient);
    const raw = await apiClient.apiRequest<unknown>(`/api/notes/${noteId}`, {
      method: 'GET',
    });
    const record = isRecord(raw) ? raw : null;
    const shouldMigrate =
      record !== null && !hasContentJson(record) && typeof record['content'] === 'string';
    if (shouldMigrate) {
      return migrateLegacyNote(record, apiClient);
    }
    return toDomainNote(record);
  };
}

function buildCreateNote(apiClient: NotesApiClient | null | undefined): NotesService['createNote'] {
  return async (initial: CreateNoteInput, options?: NoteRequestOptions): Promise<Note> => {
    ensureService(apiClient);
    const payload = buildCreatePayload(initial);
    const requestOptions = options?.signal !== undefined ? { signal: options.signal } : undefined;
    const raw = await apiClient.createNote(payload, requestOptions);
    return toDomainNote(raw);
  };
}

function buildUpdateNote(apiClient: NotesApiClient | null | undefined): NotesService['updateNote'] {
  return async (
    noteId: string,
    changes: UpdateNoteInput,
    options?: NoteRequestOptions,
  ): Promise<Note> => {
    ensureService(apiClient);
    const payload = buildUpdatePayload(changes);
    const requestOptions = buildUpdateRequestOptions(options);
    const raw = await apiClient.updateNote(noteId, payload, requestOptions);
    return toDomainNote(raw);
  };
}

function buildDeleteNote(apiClient: NotesApiClient | null | undefined): NotesService['deleteNote'] {
  return async (noteId: string): Promise<void> => {
    ensureService(apiClient);
    await apiClient.deleteNote(noteId);
  };
}

function buildToggleStar(
  apiClient: NotesApiClient | null | undefined,
  logger: NotesServiceDependencies['logger'],
): NotesService['toggleStar'] {
  return async (noteId: string): Promise<Note> => {
    ensureService(apiClient);
    if (noteId.length === 0) {
      throw new Error('Note ID is required to toggle star');
    }

    if (typeof apiClient.toggleNoteStar !== 'function') {
      const availableMethods = Object.keys(apiClient);
      const error = new AppError(
        'API client is missing toggleNoteStar method. Please rebuild initApi.js or check your API client initialization.',
        ErrorCodes.INTERNAL_ERROR,
        { details: { reason: 'API_CLIENT_ERROR', availableMethods } },
      );
      logger?.error?.('toggleStar failed: missing toggleNoteStar', { availableMethods });
      throw error;
    }

    try {
      const raw = await apiClient.toggleNoteStar(noteId);
      return toDomainNote(raw);
    } catch (error) {
      logger?.error?.('toggleStar failed', error);
      throw error;
    }
  };
}

function buildSetStar(apiClient: NotesApiClient | null | undefined): NotesService['setStar'] {
  return async (noteId: string, isStarred: boolean): Promise<Note> => {
    ensureService(apiClient);
    const raw = await apiClient.setNoteStar(noteId, isStarred);
    return toDomainNote(raw);
  };
}

function buildListAssets(apiClient: NotesApiClient | null | undefined): NotesService['listAssets'] {
  return async (noteId: string): Promise<NoteAsset[]> => {
    ensureService(apiClient);
    return apiClient.listNoteAssets({ noteId });
  };
}

function buildUploadAsset(
  apiClient: NotesApiClient | null | undefined,
): NotesService['uploadAsset'] {
  return async (noteId: string, file: File | Blob): Promise<NoteAsset> => {
    ensureService(apiClient);
    return apiClient.uploadNoteAsset({ noteId, file });
  };
}

function buildDeleteAsset(
  apiClient: NotesApiClient | null | undefined,
): NotesService['deleteAsset'] {
  return async (assetId: string): Promise<void> => {
    ensureService(apiClient);
    return apiClient.deleteNoteAsset({ assetId });
  };
}

export function createNotesService(
  apiClient: NotesApiClient | null | undefined,
  deps: NotesServiceDependencies = {},
): NotesService {
  const logger = deps.logger ?? createLogger('NotesService');

  return {
    listNotes: buildListNotes(apiClient),
    getNote: buildGetNote(apiClient),
    createNote: buildCreateNote(apiClient),
    updateNote: buildUpdateNote(apiClient),
    deleteNote: buildDeleteNote(apiClient),
    toggleStar: buildToggleStar(apiClient, logger),
    setStar: buildSetStar(apiClient),
    listAssets: buildListAssets(apiClient),
    uploadAsset: buildUploadAsset(apiClient),
    deleteAsset: buildDeleteAsset(apiClient),
  };
}

export type {
  CreateNoteInput,
  UpdateNoteInput,
  NoteRequestOptions,
  NotesApiClient,
  NotesService,
  NotesServiceDependencies,
} from './notes/notesServiceTypes';
