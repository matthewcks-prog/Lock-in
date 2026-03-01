import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { createContentFingerprint } from './noteUtils';
import {
  applySavedNote,
  buildPendingSave,
  handlePersistFailure,
  evaluateSaveResult,
  getErrorMeta,
  clearTimer,
  scheduleSavedReset,
  type ErrorMeta,
} from './persistenceUtils';
import { loadOfflineQueue, removeFromOfflineQueue } from './offlineQueue';
import {
  resolveClientNoteId,
  resolveQueueKey,
  type PersistenceDefaults,
} from './noteEditorPersistenceHelpers';

export type PersistAttempt = {
  notesService: NotesService;
  controller: AbortController;
  currentNote: Note;
  clientNoteId: string;
  expectedUpdatedAt: string | null;
  queueKey: string;
  fingerprint: string;
  saveSequence: number;
  pendingSave: ReturnType<typeof buildPendingSave>;
};

type PreparePersistAttemptParams = {
  notesService: NotesService | null | undefined;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  saveSequenceRef: MutableRefObject<number>;
  debounceRef: MutableRefObject<number | null>;
  savedResetRef: MutableRefObject<number | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  defaults: PersistenceDefaults;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

function resolvePersistTargets({
  notesService,
  noteRef,
  setError,
  setStatus,
}: {
  notesService: NotesService | null | undefined;
  noteRef: MutableRefObject<Note | null>;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
}): { notesService: NotesService; currentNote: Note } | null {
  const currentNote = noteRef.current;
  if (notesService === null || notesService === undefined || currentNote === null) {
    setError('Notes service unavailable');
    setStatus('error');
    return null;
  }
  return { notesService, currentNote };
}

function shouldSkipPersist({
  fingerprint,
  lastSavedFingerprintRef,
  setStatus,
  savedResetRef,
}: {
  fingerprint: string;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  savedResetRef: MutableRefObject<number | null>;
}): boolean {
  if (fingerprint !== lastSavedFingerprintRef.current) {
    return false;
  }
  setStatus('saved');
  scheduleSavedReset(setStatus, savedResetRef);
  return true;
}

export function preparePersistAttempt(params: PreparePersistAttemptParams): PersistAttempt | null {
  const {
    notesService,
    noteRef,
    clientNoteIdRef,
    lastSavedFingerprintRef,
    saveSequenceRef,
    debounceRef,
    savedResetRef,
    abortControllerRef,
    defaults,
    setStatus,
    setError,
  } = params;
  const targets = resolvePersistTargets({ notesService, noteRef, setError, setStatus });
  if (targets === null) return null;

  const { notesService: readyNotesService, currentNote } = targets;
  clearTimer(debounceRef);
  abortControllerRef.current?.abort();

  const fingerprint = createContentFingerprint(currentNote.title, currentNote.content);
  if (shouldSkipPersist({ fingerprint, lastSavedFingerprintRef, setStatus, savedResetRef })) {
    return null;
  }

  const clientNoteId = resolveClientNoteId(currentNote, clientNoteIdRef);
  const expectedUpdatedAt = currentNote.updatedAt ?? null;
  const queueKey = resolveQueueKey(currentNote, clientNoteId);
  const saveSequence = ++saveSequenceRef.current;
  const controller = new AbortController();
  abortControllerRef.current = controller;
  setStatus('saving');
  setError(null);

  return {
    notesService: readyNotesService,
    controller,
    currentNote,
    clientNoteId,
    expectedUpdatedAt,
    queueKey,
    fingerprint,
    saveSequence,
    pendingSave: buildPendingSave({
      note: currentNote,
      clientNoteId,
      expectedUpdatedAt,
      ...defaults,
    }),
  };
}

function shouldIgnorePersistSuccess({
  saved,
  attempt,
  noteRef,
  clientNoteIdRef,
  setStatus,
}: {
  saved: Note;
  attempt: PersistAttempt;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
}): boolean {
  const evaluation = evaluateSaveResult({
    saved,
    latestNote: noteRef.current,
    fingerprint: attempt.fingerprint,
    clientNoteIdRef,
    clientNoteId: attempt.clientNoteId,
  });
  if (!evaluation.ignore) {
    return false;
  }
  if (evaluation.markEditing) {
    setStatus('editing');
  }
  return true;
}

export function handlePersistSuccess({
  saved,
  attempt,
  noteRef,
  saveSequenceRef,
  clientNoteIdRef,
  lastSavedFingerprintRef,
  setPendingSaveCount,
  setNote,
  setStatus,
  setActiveNoteId,
  savedResetRef,
}: {
  saved: Note;
  attempt: PersistAttempt;
  noteRef: MutableRefObject<Note | null>;
  saveSequenceRef: MutableRefObject<number>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setPendingSaveCount: Dispatch<SetStateAction<number>>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setActiveNoteId: (noteId: string | null) => void;
  savedResetRef: MutableRefObject<number | null>;
}): void {
  if (attempt.controller.signal.aborted || attempt.saveSequence !== saveSequenceRef.current) {
    return;
  }
  if (shouldIgnorePersistSuccess({ saved, attempt, noteRef, clientNoteIdRef, setStatus })) {
    return;
  }

  removeFromOfflineQueue(attempt.queueKey);
  setPendingSaveCount(loadOfflineQueue().length);
  applySavedNote({
    saved,
    setNote,
    setActiveNoteId,
    clientNoteIdRef,
    lastSavedFingerprintRef,
    setStatus,
    savedResetRef,
  });
}

function shouldIgnorePersistError(meta: ErrorMeta, attempt: PersistAttempt): boolean {
  return attempt.controller.signal.aborted || meta.code === 'ABORTED';
}

export function handlePersistError({
  error,
  attempt,
  setPendingSaveCount,
  setError,
  setStatus,
}: {
  error: unknown;
  attempt: PersistAttempt;
  setPendingSaveCount: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
}): void {
  const meta = getErrorMeta(error);
  if (shouldIgnorePersistError(meta, attempt)) {
    return;
  }
  handlePersistFailure({
    meta,
    pendingSave: attempt.pendingSave,
    setPendingSaveCount,
    setError,
    setStatus,
  });
}
