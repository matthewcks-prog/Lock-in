import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteContent, NoteStatus } from '@core/domain/Note';
import type {
  CreateNoteInput,
  NotesService,
  UpdateNoteInput,
} from '@core/services/notesService';
import { MAX_SAVE_RETRIES, SAVED_RESET_DELAY_MS, SAVE_DEBOUNCE_MS } from './constants';
import {
  addToOfflineQueue,
  getQueueKey,
  loadOfflineQueue,
  removeFromOfflineQueue,
  saveOfflineQueue,
  type PendingSave,
} from './offlineQueue';
import { createClientNoteId, createContentFingerprint, createDraftNote } from './noteUtils';

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

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const fingerprint = createContentFingerprint(currentNote.title, currentNote.content);
    if (fingerprint === lastSavedFingerprintRef.current) {
      setStatus('saved');
      if (savedResetRef.current) {
        window.clearTimeout(savedResetRef.current);
      }
      savedResetRef.current = window.setTimeout(() => setStatus('idle'), SAVED_RESET_DELAY_MS);
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

    const pendingSave: PendingSave = {
      noteId: currentNote.id,
      clientNoteId,
      title: currentNote.title || 'Untitled note',
      content: currentNote.content,
      courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
      sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
      sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
      noteType: currentNote.noteType,
      tags: currentNote.tags,
      expectedUpdatedAt,
      timestamp: Date.now(),
      retryCount: 0,
    };

    try {
      let saved: Note;
      if (currentNote.id) {
        const payload: UpdateNoteInput = {
          title: currentNote.title,
          content: currentNote.content,
          courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
          noteType: currentNote.noteType,
          tags: currentNote.tags,
        };
        saved = await notesService.updateNote(currentNote.id, payload, {
          signal: controller.signal,
          expectedUpdatedAt,
        });
      } else {
        const payload: CreateNoteInput = {
          title: currentNote.title || 'Untitled note',
          content: currentNote.content,
          courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
          noteType: currentNote.noteType,
          tags: currentNote.tags,
          clientNoteId,
        };
        saved = await notesService.createNote(payload, {
          signal: controller.signal,
        });
      }

      if (controller.signal.aborted) return;
      if (saveSequence !== saveSequenceRef.current) return;

      const latestNote = noteRef.current;
      if (latestNote?.id && saved.id && latestNote.id !== saved.id) {
        return;
      }
      if (!latestNote?.id && clientNoteIdRef.current !== clientNoteId) {
        return;
      }
      const latestFingerprint = latestNote
        ? createContentFingerprint(latestNote.title, latestNote.content)
        : null;
      if (latestFingerprint && latestFingerprint !== fingerprint) {
        setStatus('editing');
        return;
      }

      removeFromOfflineQueue(queueKey);
      setPendingSaveCount(loadOfflineQueue().length);

      setNote(saved);
      setActiveNoteId(saved.id);
      if (saved.id) {
        clientNoteIdRef.current = saved.id;
      }
      lastSavedFingerprintRef.current = createContentFingerprint(saved.title, saved.content);
      setStatus('saved');
      if (savedResetRef.current) {
        window.clearTimeout(savedResetRef.current);
      }
      savedResetRef.current = window.setTimeout(() => setStatus('idle'), SAVED_RESET_DELAY_MS);
    } catch (err: any) {
      if (controller.signal.aborted || err?.code === 'ABORTED') return;

      const isNetworkError = err?.code === 'NETWORK_ERROR' || !navigator.onLine;
      const isRetryable =
        isNetworkError || err?.code === 'RATE_LIMIT' || err?.status === 429 || err?.status >= 500;

      if (isRetryable && pendingSave.retryCount < MAX_SAVE_RETRIES) {
        addToOfflineQueue(pendingSave);
        setPendingSaveCount(loadOfflineQueue().length);
        setError(
          isNetworkError ? 'Saved offline - will sync when connected' : 'Save queued for retry',
        );
        setStatus('error');
      } else {
        setError(err?.message || 'Failed to save note');
        setStatus('error');
      }
    }
  }, [defaultCourseCode, defaultSourceUrl, lastSavedFingerprintRef, notesService, noteRef, setActiveNoteId, setError, setNote, setStatus, sourceSelection]);

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
        const base =
          prev ??
          createDraftNote({
            courseCode: defaultCourseCode,
            sourceUrl: defaultSourceUrl,
            sourceSelection,
          });
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
        const base =
          prev ??
          createDraftNote({
            courseCode: defaultCourseCode,
            sourceUrl: defaultSourceUrl,
            sourceSelection,
          });
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
    const draft = createDraftNote({
      courseCode: defaultCourseCode,
      sourceUrl: defaultSourceUrl,
      sourceSelection,
    });
    setNote(draft);
    lastSavedFingerprintRef.current = null;
    setStatus('idle');
    setError(null);
  }, [clientNoteIdRef, defaultCourseCode, defaultSourceUrl, lastSavedFingerprintRef, setActiveNoteId, setError, setNote, setStatus, sourceSelection]);

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
          const payload: UpdateNoteInput = {
            title: pendingSave.title,
            content: pendingSave.content,
            courseCode: pendingSave.courseCode,
            sourceUrl: pendingSave.sourceUrl,
            sourceSelection: pendingSave.sourceSelection,
            noteType: pendingSave.noteType as any,
            tags: pendingSave.tags,
          };
          saved = await notesService.updateNote(pendingSave.noteId, payload, {
            expectedUpdatedAt: pendingSave.expectedUpdatedAt ?? undefined,
          });
        } else {
          const payload: CreateNoteInput = {
            title: pendingSave.title,
            content: pendingSave.content,
            courseCode: pendingSave.courseCode,
            sourceUrl: pendingSave.sourceUrl,
            sourceSelection: pendingSave.sourceSelection,
            noteType: pendingSave.noteType as any,
            tags: pendingSave.tags,
            clientNoteId: pendingSave.clientNoteId,
          };
          saved = await notesService.createNote(payload);
        }

        removeFromOfflineQueue(queueKey);
        console.log(
          `[NoteEditor] Synced offline save for note ${pendingSave.noteId || pendingSave.clientNoteId || 'new'}`,
        );

        if (saved) {
          const latestNote = noteRef.current;
          const pendingFingerprint = createContentFingerprint(
            pendingSave.title,
            pendingSave.content,
          );
          const latestFingerprint = latestNote
            ? createContentFingerprint(latestNote.title, latestNote.content)
            : null;
          const isSameDraft =
            !latestNote?.id && clientNoteIdRef.current === pendingSave.clientNoteId;
          const isSameNote = latestNote?.id && latestNote.id === saved.id;

          if ((isSameDraft || isSameNote) && latestFingerprint === pendingFingerprint) {
            setNote(saved);
            setActiveNoteId(saved.id);
            if (saved.id) {
              clientNoteIdRef.current = saved.id;
            }
            lastSavedFingerprintRef.current = createContentFingerprint(saved.title, saved.content);
            setStatus('saved');
            if (savedResetRef.current) {
              window.clearTimeout(savedResetRef.current);
            }
            savedResetRef.current = window.setTimeout(
              () => setStatus('idle'),
              SAVED_RESET_DELAY_MS,
            );
          }
        }
      } catch (err: any) {
        console.error(`[NoteEditor] Failed to sync offline save:`, err);
        const isRetryable =
          err?.code === 'NETWORK_ERROR' ||
          err?.code === 'RATE_LIMIT' ||
          err?.status === 429 ||
          err?.status >= 500;
        const isStale = err?.code === 'CONFLICT' || err?.code === 'NOT_FOUND';

        const updated = loadOfflineQueue().map((s) =>
          getQueueKey(s) === queueKey ? { ...s, retryCount: (s.retryCount ?? 0) + 1 } : s,
        );
        let filtered = updated.filter((s) => s.retryCount < MAX_SAVE_RETRIES);
        if (!isRetryable || isStale) {
          filtered = filtered.filter((s) => getQueueKey(s) !== queueKey);
        }
        saveOfflineQueue(filtered);
      }
    }

    setPendingSaveCount(loadOfflineQueue().length);
  }, [clientNoteIdRef, lastSavedFingerprintRef, notesService, noteRef, setActiveNoteId, setNote, setStatus]);

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
