import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import {
  getQueueKey,
  loadOfflineQueue,
  removeFromOfflineQueue,
  type PendingSave,
} from './offlineQueue';
import {
  applySavedNote,
  getErrorMeta,
  shouldApplySyncedSave,
  updateQueueAfterSyncFailure,
} from './persistenceUtils';
import {
  resolvePendingSaveLogId,
  syncPendingSaveWithService,
} from './noteEditorPersistenceHelpers';

function applySyncedSave({
  saved,
  pendingSave,
  noteRef,
  clientNoteIdRef,
  setNote,
  setActiveNoteId,
  lastSavedFingerprintRef,
  setStatus,
  savedResetRef,
}: {
  saved: Note;
  pendingSave: PendingSave;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setActiveNoteId: (noteId: string | null) => void;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  savedResetRef: MutableRefObject<number | null>;
}): void {
  if (
    !shouldApplySyncedSave({ saved, pendingSave, latestNote: noteRef.current, clientNoteIdRef })
  ) {
    return;
  }

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

async function syncSinglePendingSave({
  notesService,
  pendingSave,
  queueKey,
  noteRef,
  clientNoteIdRef,
  lastSavedFingerprintRef,
  savedResetRef,
  setNote,
  setStatus,
  setActiveNoteId,
}: {
  notesService: NotesService;
  pendingSave: PendingSave;
  queueKey: string;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  savedResetRef: MutableRefObject<number | null>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setActiveNoteId: (noteId: string | null) => void;
}): Promise<void> {
  const saved = await syncPendingSaveWithService(notesService, pendingSave);
  removeFromOfflineQueue(queueKey);
  console.log(`[NoteEditor] Synced offline save for note ${resolvePendingSaveLogId(pendingSave)}`);
  applySyncedSave({
    saved,
    pendingSave,
    noteRef,
    clientNoteIdRef,
    setNote,
    setActiveNoteId,
    lastSavedFingerprintRef,
    setStatus,
    savedResetRef,
  });
}

export async function syncOfflineQueueEntries({
  notesService,
  noteRef,
  clientNoteIdRef,
  lastSavedFingerprintRef,
  savedResetRef,
  setPendingSaveCount,
  setNote,
  setStatus,
  setActiveNoteId,
}: {
  notesService: NotesService | null | undefined;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  savedResetRef: MutableRefObject<number | null>;
  setPendingSaveCount: Dispatch<SetStateAction<number>>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setActiveNoteId: (noteId: string | null) => void;
}): Promise<void> {
  if (notesService === null || notesService === undefined) return;

  const queue = loadOfflineQueue();
  if (queue.length === 0) return;
  console.log(`[NoteEditor] Syncing ${queue.length} offline saves`);

  for (const pendingSave of queue) {
    const queueKey = getQueueKey(pendingSave);
    try {
      await syncSinglePendingSave({
        notesService,
        pendingSave,
        queueKey,
        noteRef,
        clientNoteIdRef,
        lastSavedFingerprintRef,
        savedResetRef,
        setNote,
        setStatus,
        setActiveNoteId,
      });
    } catch (error: unknown) {
      console.error('[NoteEditor] Failed to sync offline save:', error);
      updateQueueAfterSyncFailure(queueKey, getErrorMeta(error));
    }
  }

  setPendingSaveCount(loadOfflineQueue().length);
}
