import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteContent, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { SAVE_DEBOUNCE_MS } from './constants';
import { getQueueKey, loadOfflineQueue, removeFromOfflineQueue } from './offlineQueue';
import { createClientNoteId, createContentFingerprint, createDraftNote } from './noteUtils';
import {
  applySavedNote,
  buildPendingCreatePayload,
  buildPendingSave,
  buildPendingUpdatePayload,
  clearTimer,
  evaluateSaveResult,
  getErrorMeta,
  handlePersistFailure,
  saveNoteToService,
  scheduleSavedReset,
  shouldApplySyncedSave,
  updateQueueAfterSyncFailure,
} from './persistenceUtils';

export interface NoteEditorPersistenceOptions {
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null;
  defaultSourceUrl?: string | null;
  sourceSelection?: string | null;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setActiveNoteId: (noteId: string | null) => void;
}

export interface NoteEditorPersistenceResult {
  pendingSaveCount: number;
  handleContentChange: (content: NoteContent) => void;
  handleTitleChange: (title: string) => void;
  saveNow: () => Promise<void>;
  resetToNew: () => void;
  syncOfflineQueue: () => Promise<void>;
}

export function useNoteEditorPersistence({
  notesService,
  defaultCourseCode,
  defaultSourceUrl,
  sourceSelection,
  noteRef,
  clientNoteIdRef,
  lastSavedFingerprintRef,
  setNote,
  setStatus,
  setError,
  setActiveNoteId,
}: NoteEditorPersistenceOptions): NoteEditorPersistenceResult {
  const saveSequenceRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const savedResetRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      if (savedResetRef.current) {
        window.clearTimeout(savedResetRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const [pendingSaveCount, setPendingSaveCount] = useState(() => loadOfflineQueue().length);

  const persist = useCallback(async () => {
    const currentNote = noteRef.current;

    if (!notesService || !currentNote) {
      setError('Notes service unavailable');
      setStatus('error');
      return;
    }

    clearTimer(debounceRef);
    abortControllerRef.current?.abort();

    const fingerprint = createContentFingerprint(currentNote.title, currentNote.content);
    if (fingerprint === lastSavedFingerprintRef.current) {
      setStatus('saved');
      scheduleSavedReset(setStatus, savedResetRef);
      return;
    }

    const clientNoteId = currentNote.id || clientNoteIdRef.current || createClientNoteId();
    if (!currentNote.id) {
      clientNoteIdRef.current = clientNoteId;
    }
    const expectedUpdatedAt = currentNote.updatedAt ?? null;
    const queueKey = currentNote.id || clientNoteId;
    const saveSequence = ++saveSequenceRef.current;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus('saving');
    setError(null);

    const defaults: {
      defaultCourseCode?: string | null;
      defaultSourceUrl?: string | null;
      sourceSelection?: string | null;
    } = {};
    if (defaultCourseCode !== undefined) {
      defaults.defaultCourseCode = defaultCourseCode;
    }
    if (defaultSourceUrl !== undefined) {
      defaults.defaultSourceUrl = defaultSourceUrl;
    }
    if (sourceSelection !== undefined) {
      defaults.sourceSelection = sourceSelection;
    }
    const pendingSave = buildPendingSave({
      note: currentNote,
      clientNoteId,
      expectedUpdatedAt,
      ...defaults,
    });

    try {
      const saved = await saveNoteToService({
        notesService,
        note: currentNote,
        clientNoteId,
        expectedUpdatedAt,
        controller,
        defaults,
      });

      if (controller.signal.aborted) return;
      if (saveSequence !== saveSequenceRef.current) return;

      const latestNote = noteRef.current;
      const evaluation = evaluateSaveResult({
        saved,
        latestNote,
        fingerprint,
        clientNoteIdRef,
        clientNoteId,
      });
      if (evaluation.ignore) {
        if (evaluation.markEditing) {
          setStatus('editing');
        }
        return;
      }

      removeFromOfflineQueue(queueKey);
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
    } catch (err: unknown) {
      const meta = getErrorMeta(err);
      if (controller.signal.aborted || meta.code === 'ABORTED') return;
      handlePersistFailure({
        meta,
        pendingSave,
        setPendingSaveCount,
        setError,
        setStatus,
      });
    }
  }, [
    defaultCourseCode,
    defaultSourceUrl,
    lastSavedFingerprintRef,
    notesService,
    noteRef,
    setActiveNoteId,
    setError,
    setNote,
    setStatus,
    sourceSelection,
  ]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  const handleContentChange = useCallback(
    (content: NoteContent) => {
      setNote((prev: Note | null) => {
        const draftDefaults: {
          courseCode?: string | null;
          sourceUrl?: string | null;
          sourceSelection?: string | null;
        } = {};
        if (defaultCourseCode !== undefined) {
          draftDefaults.courseCode = defaultCourseCode;
        }
        if (defaultSourceUrl !== undefined) {
          draftDefaults.sourceUrl = defaultSourceUrl;
        }
        if (sourceSelection !== undefined) {
          draftDefaults.sourceSelection = sourceSelection;
        }
        const base = prev ?? createDraftNote(draftDefaults);
        return { ...base, content };
      });
      setStatus('editing');
      scheduleSave();
    },
    [defaultCourseCode, defaultSourceUrl, scheduleSave, setNote, setStatus, sourceSelection],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      setNote((prev: Note | null) => {
        const draftDefaults: {
          courseCode?: string | null;
          sourceUrl?: string | null;
          sourceSelection?: string | null;
        } = {};
        if (defaultCourseCode !== undefined) {
          draftDefaults.courseCode = defaultCourseCode;
        }
        if (defaultSourceUrl !== undefined) {
          draftDefaults.sourceUrl = defaultSourceUrl;
        }
        if (sourceSelection !== undefined) {
          draftDefaults.sourceSelection = sourceSelection;
        }
        const base = prev ?? createDraftNote(draftDefaults);
        return { ...base, title };
      });
      setStatus('editing');
      scheduleSave();
    },
    [defaultCourseCode, defaultSourceUrl, scheduleSave, setNote, setStatus, sourceSelection],
  );

  const saveNow = useCallback(async () => {
    await persist();
  }, [persist]);

  const resetToNew = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    abortControllerRef.current?.abort();
    saveSequenceRef.current += 1;
    setActiveNoteId(null);
    clientNoteIdRef.current = createClientNoteId();
    const draftDefaults: {
      courseCode?: string | null;
      sourceUrl?: string | null;
      sourceSelection?: string | null;
    } = {};
    if (defaultCourseCode !== undefined) {
      draftDefaults.courseCode = defaultCourseCode;
    }
    if (defaultSourceUrl !== undefined) {
      draftDefaults.sourceUrl = defaultSourceUrl;
    }
    if (sourceSelection !== undefined) {
      draftDefaults.sourceSelection = sourceSelection;
    }
    const draft = createDraftNote(draftDefaults);
    setNote(draft);
    lastSavedFingerprintRef.current = null;
    setStatus('idle');
    setError(null);
  }, [
    clientNoteIdRef,
    defaultCourseCode,
    defaultSourceUrl,
    lastSavedFingerprintRef,
    setActiveNoteId,
    setError,
    setNote,
    setStatus,
    sourceSelection,
  ]);

  const syncOfflineQueue = useCallback(async () => {
    if (!notesService) return;

    const queue = loadOfflineQueue();
    if (queue.length === 0) return;

    console.log(`[NoteEditor] Syncing ${queue.length} offline saves`);

    for (const pendingSave of queue) {
      const queueKey = getQueueKey(pendingSave);
      try {
        let saved: Note | null = null;
        if (pendingSave.noteId) {
          const payload = buildPendingUpdatePayload(pendingSave);
          const updateOptions: { expectedUpdatedAt?: string | null } = {};
          if (pendingSave.expectedUpdatedAt !== undefined) {
            updateOptions.expectedUpdatedAt = pendingSave.expectedUpdatedAt;
          }
          saved = await notesService.updateNote(pendingSave.noteId, payload, updateOptions);
        } else {
          const payload = buildPendingCreatePayload(pendingSave);
          saved = await notesService.createNote(payload);
        }

        removeFromOfflineQueue(queueKey);
        console.log(
          `[NoteEditor] Synced offline save for note ${pendingSave.noteId || pendingSave.clientNoteId || 'new'}`,
        );

        if (saved) {
          const latestNote = noteRef.current;
          if (
            shouldApplySyncedSave({
              saved,
              pendingSave,
              latestNote,
              clientNoteIdRef,
            })
          ) {
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
        }
      } catch (err: unknown) {
        console.error(`[NoteEditor] Failed to sync offline save:`, err);
        const meta = getErrorMeta(err);
        updateQueueAfterSyncFailure(queueKey, meta);
      }
    }

    setPendingSaveCount(loadOfflineQueue().length);
  }, [
    clientNoteIdRef,
    lastSavedFingerprintRef,
    notesService,
    noteRef,
    setActiveNoteId,
    setNote,
    setStatus,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[NoteEditor] Back online - syncing offline queue');
      void syncOfflineQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncOfflineQueue]);

  return {
    pendingSaveCount,
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
    syncOfflineQueue,
  };
}
