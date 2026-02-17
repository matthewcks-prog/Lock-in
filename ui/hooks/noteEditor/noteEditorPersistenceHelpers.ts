import type { MutableRefObject } from 'react';
import type { Note } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import type { PendingSave } from './offlineQueue';
import { createClientNoteId, createDraftNote } from './noteUtils';
import { buildPendingCreatePayload, buildPendingUpdatePayload } from './persistenceUtils';

export type PersistenceDefaults = {
  defaultCourseCode?: string | null;
  defaultSourceUrl?: string | null;
  sourceSelection?: string | null;
};

export function buildPersistenceDefaults({
  defaultCourseCode,
  defaultSourceUrl,
  sourceSelection,
}: {
  defaultCourseCode: string | null | undefined;
  defaultSourceUrl: string | null | undefined;
  sourceSelection: string | null | undefined;
}): PersistenceDefaults {
  const defaults: PersistenceDefaults = {};
  if (defaultCourseCode !== undefined) {
    defaults.defaultCourseCode = defaultCourseCode;
  }
  if (defaultSourceUrl !== undefined) {
    defaults.defaultSourceUrl = defaultSourceUrl;
  }
  if (sourceSelection !== undefined) {
    defaults.sourceSelection = sourceSelection;
  }
  return defaults;
}

function hasNonEmptyId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function resolveClientNoteId(note: Note, clientNoteIdRef: MutableRefObject<string>): string {
  if (hasNonEmptyId(note.id)) {
    return note.id;
  }

  const clientNoteId =
    clientNoteIdRef.current.length > 0 ? clientNoteIdRef.current : createClientNoteId();
  clientNoteIdRef.current = clientNoteId;
  return clientNoteId;
}

export function resolveQueueKey(note: Note, clientNoteId: string): string {
  return hasNonEmptyId(note.id) ? note.id : clientNoteId;
}

export function resolvePendingSaveLogId(pendingSave: PendingSave): string {
  if (hasNonEmptyId(pendingSave.noteId)) {
    return pendingSave.noteId;
  }
  if (pendingSave.clientNoteId.length > 0) {
    return pendingSave.clientNoteId;
  }
  return 'new';
}

export function createDraftWithDefaults(defaults: PersistenceDefaults): Note {
  return createDraftNote(defaults);
}

export function resolveDraftBase(prev: Note | null, defaults: PersistenceDefaults): Note {
  return prev ?? createDraftWithDefaults(defaults);
}

export async function syncPendingSaveWithService(
  notesService: NotesService,
  pendingSave: PendingSave,
): Promise<Note> {
  if (hasNonEmptyId(pendingSave.noteId)) {
    const payload = buildPendingUpdatePayload(pendingSave);
    const updateOptions: { expectedUpdatedAt?: string | null } = {};
    if (pendingSave.expectedUpdatedAt !== undefined) {
      updateOptions.expectedUpdatedAt = pendingSave.expectedUpdatedAt;
    }
    return notesService.updateNote(pendingSave.noteId, payload, updateOptions);
  }

  const payload = buildPendingCreatePayload(pendingSave);
  return notesService.createNote(payload);
}
