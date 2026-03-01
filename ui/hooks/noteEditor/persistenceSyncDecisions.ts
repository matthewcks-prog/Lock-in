import type { MutableRefObject } from 'react';
import type { Note } from '@core/domain/Note';
import { MAX_SAVE_RETRIES } from './constants';
import { getQueueKey, loadOfflineQueue, saveOfflineQueue, type PendingSave } from './offlineQueue';
import { createContentFingerprint } from './noteUtils';

const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_SERVER_ERROR = 500;

export type ErrorMeta = {
  code?: string;
  status?: number;
  message?: string;
};

function hasNoteId(noteId: string | null | undefined): noteId is string {
  return typeof noteId === 'string' && noteId.length > 0;
}

function getNoteFingerprint(note: Note | null): string | null {
  if (note === null) {
    return null;
  }
  return createContentFingerprint(note.title, note.content);
}

function isDifferentPersistedNote({
  latestNoteId,
  savedId,
}: {
  latestNoteId: string | null | undefined;
  savedId: string | null;
}): boolean {
  return hasNoteId(latestNoteId) && hasNoteId(savedId) && latestNoteId !== savedId;
}

function isDifferentDraftSession({
  latestNoteId,
  currentClientNoteId,
  requestClientNoteId,
}: {
  latestNoteId: string | null | undefined;
  currentClientNoteId: string;
  requestClientNoteId: string;
}): boolean {
  return !hasNoteId(latestNoteId) && currentClientNoteId !== requestClientNoteId;
}

function hasFingerprintDrift({
  latestFingerprint,
  requestFingerprint,
}: {
  latestFingerprint: string | null;
  requestFingerprint: string;
}): boolean {
  return (
    latestFingerprint !== null &&
    latestFingerprint.length > 0 &&
    latestFingerprint !== requestFingerprint
  );
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
  const latestNoteId = latestNote?.id;
  if (isDifferentPersistedNote({ latestNoteId, savedId: saved.id })) {
    return { ignore: true, markEditing: false };
  }
  if (
    isDifferentDraftSession({
      latestNoteId,
      currentClientNoteId: clientNoteIdRef.current,
      requestClientNoteId: clientNoteId,
    })
  ) {
    return { ignore: true, markEditing: false };
  }
  if (
    hasFingerprintDrift({
      latestFingerprint: getNoteFingerprint(latestNote),
      requestFingerprint: fingerprint,
    })
  ) {
    return { ignore: true, markEditing: true };
  }
  return { ignore: false, markEditing: false };
}

export function isRetryableError(meta: ErrorMeta): boolean {
  const status = meta.status ?? 0;
  return (
    meta.code === 'NETWORK_ERROR' ||
    meta.code === 'RATE_LIMIT' ||
    status === HTTP_STATUS_TOO_MANY_REQUESTS ||
    status >= HTTP_STATUS_SERVER_ERROR
  );
}

function isSameDraftSession({
  latestNoteId,
  currentClientNoteId,
  pendingClientNoteId,
}: {
  latestNoteId: string | null | undefined;
  currentClientNoteId: string;
  pendingClientNoteId: string;
}): boolean {
  return !hasNoteId(latestNoteId) && currentClientNoteId === pendingClientNoteId;
}

function isSamePersistedNote({
  latestNoteId,
  savedId,
}: {
  latestNoteId: string | null | undefined;
  savedId: string | null;
}): boolean {
  return hasNoteId(latestNoteId) && hasNoteId(savedId) && latestNoteId === savedId;
}

function fingerprintsMatch(latestFingerprint: string | null, pendingFingerprint: string): boolean {
  return (
    latestFingerprint !== null &&
    latestFingerprint.length > 0 &&
    latestFingerprint === pendingFingerprint
  );
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
  const latestNoteId = latestNote?.id;
  const sameTarget =
    isSameDraftSession({
      latestNoteId,
      currentClientNoteId: clientNoteIdRef.current,
      pendingClientNoteId: pendingSave.clientNoteId,
    }) || isSamePersistedNote({ latestNoteId, savedId: saved.id });

  if (!sameTarget) {
    return false;
  }

  const pendingFingerprint = createContentFingerprint(pendingSave.title, pendingSave.content);
  return fingerprintsMatch(getNoteFingerprint(latestNote), pendingFingerprint);
}

export function updateQueueAfterSyncFailure(queueKey: string, meta: ErrorMeta): PendingSave[] {
  const isStale = meta.code === 'CONFLICT' || meta.code === 'NOT_FOUND';
  const retryable = isRetryableError(meta);
  const incrementedQueue = loadOfflineQueue().map((save) =>
    getQueueKey(save) === queueKey ? { ...save, retryCount: (save.retryCount ?? 0) + 1 } : save,
  );
  const retryableQueue = incrementedQueue.filter((save) => save.retryCount < MAX_SAVE_RETRIES);
  const filteredQueue =
    !retryable || isStale
      ? retryableQueue.filter((save) => getQueueKey(save) !== queueKey)
      : retryableQueue;
  saveOfflineQueue(filteredQueue);
  return filteredQueue;
}
