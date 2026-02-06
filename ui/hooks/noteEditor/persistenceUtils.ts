import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { CreateNoteInput, NotesService, UpdateNoteInput } from '@core/services/notesService';
import { MAX_SAVE_RETRIES, SAVED_RESET_DELAY_MS } from './constants';
import {
  addToOfflineQueue,
  getQueueKey,
  loadOfflineQueue,
  saveOfflineQueue,
  type PendingSave,
} from './offlineQueue';
import { createContentFingerprint } from './noteUtils';

export type ErrorMeta = {
  code?: string;
  status?: number;
  message?: string;
};

export function getErrorMeta(err: unknown): ErrorMeta {
  const record = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : null;
  const meta: ErrorMeta = {};
  if (typeof record?.['code'] === 'string') {
    meta.code = record['code'];
  }
  if (typeof record?.['status'] === 'number') {
    meta.status = record['status'];
  }
  const message =
    (err instanceof Error && err.message) ||
    (typeof record?.['message'] === 'string' ? record['message'] : undefined);
  if (message) {
    meta.message = message;
  }
  return meta;
}

export function clearTimer(ref: MutableRefObject<number | null>) {
  if (ref.current) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

export function scheduleSavedReset(
  setStatus: Dispatch<SetStateAction<NoteStatus>>,
  savedResetRef: MutableRefObject<number | null>,
) {
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
    title: note.title || 'Untitled note',
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
    title: note.title || 'Untitled note',
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
  if (note.id) {
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

export function evaluateSaveResult({
  saved,
  latestNote,
  fingerprint,
  clientNoteIdRef,
  clientNoteId,
}: {
  saved: Note;
  latestNote: Note | null;
  fingerprint: string;
  clientNoteIdRef: MutableRefObject<string>;
  clientNoteId: string;
}): { ignore: boolean; markEditing: boolean } {
  if (latestNote?.id && saved.id && latestNote.id !== saved.id) {
    return { ignore: true, markEditing: false };
  }
  if (!latestNote?.id && clientNoteIdRef.current !== clientNoteId) {
    return { ignore: true, markEditing: false };
  }
  const latestFingerprint = latestNote
    ? createContentFingerprint(latestNote.title, latestNote.content)
    : null;
  if (latestFingerprint && latestFingerprint !== fingerprint) {
    return { ignore: true, markEditing: true };
  }
  return { ignore: false, markEditing: false };
}

export function isRetryableError(meta: ErrorMeta): boolean {
  return (
    meta.code === 'NETWORK_ERROR' ||
    meta.code === 'RATE_LIMIT' ||
    meta.status === 429 ||
    (meta.status ?? 0) >= 500
  );
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
}) {
  const networkError = meta.code === 'NETWORK_ERROR' || !navigator.onLine;
  const retryable = networkError || isRetryableError(meta);

  if (retryable && pendingSave.retryCount < MAX_SAVE_RETRIES) {
    addToOfflineQueue(pendingSave);
    setPendingSaveCount(loadOfflineQueue().length);
    setError(networkError ? 'Saved offline - will sync when connected' : 'Save queued for retry');
    setStatus('error');
    return;
  }

  setError(meta.message || 'Failed to save note');
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
}) {
  setNote(saved);
  setActiveNoteId(saved.id);
  if (saved.id) {
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

export function shouldApplySyncedSave({
  saved,
  pendingSave,
  latestNote,
  clientNoteIdRef,
}: {
  saved: Note;
  pendingSave: PendingSave;
  latestNote: Note | null;
  clientNoteIdRef: MutableRefObject<string>;
}): boolean {
  const pendingFingerprint = createContentFingerprint(pendingSave.title, pendingSave.content);
  const latestFingerprint = latestNote
    ? createContentFingerprint(latestNote.title, latestNote.content)
    : null;
  const isSameDraft = !latestNote?.id && clientNoteIdRef.current === pendingSave.clientNoteId;
  const isSameNote = latestNote?.id && latestNote.id === saved.id;

  return Boolean((isSameDraft || isSameNote) && latestFingerprint === pendingFingerprint);
}

export function updateQueueAfterSyncFailure(queueKey: string, meta: ErrorMeta): PendingSave[] {
  const isStale = meta.code === 'CONFLICT' || meta.code === 'NOT_FOUND';
  const retryable = isRetryableError(meta);
  const updated = loadOfflineQueue().map((save) =>
    getQueueKey(save) === queueKey ? { ...save, retryCount: (save.retryCount ?? 0) + 1 } : save,
  );
  let filtered = updated.filter((save) => save.retryCount < MAX_SAVE_RETRIES);
  if (!retryable || isStale) {
    filtered = filtered.filter((save) => getQueueKey(save) !== queueKey);
  }
  saveOfflineQueue(filtered);
  return filtered;
}
