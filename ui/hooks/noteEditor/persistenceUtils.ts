import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { CreateNoteInput, NotesService, UpdateNoteInput } from '@core/services/notesService';
import { MAX_SAVE_RETRIES, SAVED_RESET_DELAY_MS } from './constants';
import { addToOfflineQueue, loadOfflineQueue, type PendingSave } from './offlineQueue';
import { createContentFingerprint } from './noteUtils';
import {
  evaluateSaveResult,
  isRetryableError,
  shouldApplySyncedSave,
  updateQueueAfterSyncFailure,
  type ErrorMeta,
} from './persistenceSyncDecisions';

export { evaluateSaveResult, isRetryableError, shouldApplySyncedSave, updateQueueAfterSyncFailure };
export type { ErrorMeta } from './persistenceSyncDecisions';

export function getErrorMeta(err: unknown): ErrorMeta {
  const record = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : null;
  const meta: ErrorMeta = {};
  if (typeof record?.['code'] === 'string') {
    meta.code = record['code'];
  }
  if (typeof record?.['status'] === 'number') {
    meta.status = record['status'];
  }
  const errorMessage = err instanceof Error ? err.message : undefined;
  const recordMessage = typeof record?.['message'] === 'string' ? record['message'] : undefined;
  const message =
    errorMessage !== undefined && errorMessage.length > 0 ? errorMessage : recordMessage;
  if (message !== undefined && message.length > 0) {
    meta.message = message;
  }
  return meta;
}

export function clearTimer(ref: MutableRefObject<number | null>): void {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

export function scheduleSavedReset(
  setStatus: Dispatch<SetStateAction<NoteStatus>>,
  savedResetRef: MutableRefObject<number | null>,
): void {
  clearTimer(savedResetRef);
  savedResetRef.current = window.setTimeout(() => setStatus('idle'), SAVED_RESET_DELAY_MS);
}

export function buildPendingSave({
  note,
  clientNoteId,
  defaultCourseCode,
  defaultSourceUrl,
  sourceSelection,
  expectedUpdatedAt,
}: {
  note: Note;
  clientNoteId: string;
  defaultCourseCode?: string | null;
  defaultSourceUrl?: string | null;
  sourceSelection?: string | null;
  expectedUpdatedAt: string | null;
}): PendingSave {
  return {
    noteId: note.id,
    clientNoteId,
    title: note.title.length > 0 ? note.title : 'Untitled note',
    content: note.content,
    courseCode: note.courseCode ?? defaultCourseCode ?? null,
    sourceUrl: note.sourceUrl ?? defaultSourceUrl ?? null,
    sourceSelection: note.sourceSelection ?? sourceSelection ?? null,
    noteType: note.noteType,
    tags: note.tags,
    expectedUpdatedAt,
    timestamp: Date.now(),
    retryCount: 0,
  };
}

export function buildUpdatePayload(
  note: Note,
  defaults: {
    defaultCourseCode?: string | null;
    defaultSourceUrl?: string | null;
    sourceSelection?: string | null;
  },
): UpdateNoteInput {
  return {
    title: note.title,
    content: note.content,
    courseCode: note.courseCode ?? defaults.defaultCourseCode ?? null,
    sourceUrl: note.sourceUrl ?? defaults.defaultSourceUrl ?? null,
    sourceSelection: note.sourceSelection ?? defaults.sourceSelection ?? null,
    noteType: note.noteType,
    tags: note.tags,
  };
}

export function buildCreatePayload(
  note: Note,
  clientNoteId: string,
  defaults: {
    defaultCourseCode?: string | null;
    defaultSourceUrl?: string | null;
    sourceSelection?: string | null;
  },
): CreateNoteInput {
  return {
    title: note.title.length > 0 ? note.title : 'Untitled note',
    content: note.content,
    courseCode: note.courseCode ?? defaults.defaultCourseCode ?? null,
    sourceUrl: note.sourceUrl ?? defaults.defaultSourceUrl ?? null,
    sourceSelection: note.sourceSelection ?? defaults.sourceSelection ?? null,
    noteType: note.noteType,
    tags: note.tags,
    clientNoteId,
  };
}

export async function saveNoteToService({
  notesService,
  note,
  clientNoteId,
  expectedUpdatedAt,
  controller,
  defaults,
}: {
  notesService: NotesService;
  note: Note;
  clientNoteId: string;
  expectedUpdatedAt: string | null;
  controller: AbortController;
  defaults: {
    defaultCourseCode?: string | null;
    defaultSourceUrl?: string | null;
    sourceSelection?: string | null;
  };
}): Promise<Note> {
  if (note.id !== null && note.id !== undefined && note.id.length > 0) {
    const payload = buildUpdatePayload(note, defaults);
    return notesService.updateNote(note.id, payload, {
      signal: controller.signal,
      expectedUpdatedAt,
    });
  }

  const payload = buildCreatePayload(note, clientNoteId, defaults);
  return notesService.createNote(payload, {
    signal: controller.signal,
  });
}

export function handlePersistFailure({
  meta,
  pendingSave,
  setPendingSaveCount,
  setError,
  setStatus,
}: {
  meta: ErrorMeta;
  pendingSave: PendingSave;
  setPendingSaveCount: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
}): void {
  const networkError = meta.code === 'NETWORK_ERROR' || !navigator.onLine;
  const retryable = networkError || isRetryableError(meta);

  if (retryable && pendingSave.retryCount < MAX_SAVE_RETRIES) {
    addToOfflineQueue(pendingSave);
    setPendingSaveCount(loadOfflineQueue().length);
    setError(networkError ? 'Saved offline - will sync when connected' : 'Save queued for retry');
    setStatus('error');
    return;
  }

  setError(
    meta.message !== undefined && meta.message.length > 0 ? meta.message : 'Failed to save note',
  );
  setStatus('error');
}

export function applySavedNote({
  saved,
  setNote,
  setActiveNoteId,
  clientNoteIdRef,
  lastSavedFingerprintRef,
  setStatus,
  savedResetRef,
}: {
  saved: Note;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setActiveNoteId: (noteId: string | null) => void;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  savedResetRef: MutableRefObject<number | null>;
}): void {
  setNote(saved);
  setActiveNoteId(saved.id);
  if (saved.id !== null && saved.id !== undefined && saved.id.length > 0) {
    clientNoteIdRef.current = saved.id;
  }
  lastSavedFingerprintRef.current = createContentFingerprint(saved.title, saved.content);
  setStatus('saved');
  scheduleSavedReset(setStatus, savedResetRef);
}

export function buildPendingUpdatePayload(pendingSave: PendingSave): UpdateNoteInput {
  return {
    title: pendingSave.title,
    content: pendingSave.content,
    courseCode: pendingSave.courseCode,
    sourceUrl: pendingSave.sourceUrl,
    sourceSelection: pendingSave.sourceSelection,
    noteType: pendingSave.noteType,
    tags: pendingSave.tags,
  };
}

export function buildPendingCreatePayload(pendingSave: PendingSave): CreateNoteInput {
  return {
    title: pendingSave.title,
    content: pendingSave.content,
    courseCode: pendingSave.courseCode,
    sourceUrl: pendingSave.sourceUrl,
    sourceSelection: pendingSave.sourceSelection,
    noteType: pendingSave.noteType,
    tags: pendingSave.tags,
    clientNoteId: pendingSave.clientNoteId,
  };
}
