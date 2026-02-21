import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteContent, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { loadOfflineQueue } from './offlineQueue';
import { buildPersistenceDefaults } from './noteEditorPersistenceHelpers';
import { usePersistenceCallbacks } from './useNoteEditorPersistenceCallbacks';

export interface NoteEditorPersistenceOptions {
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null | undefined;
  defaultSourceUrl?: string | null | undefined;
  defaultWeek?: number | null | undefined;
  sourceSelection?: string | null | undefined;
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

function usePersistenceCleanup({
  debounceRef,
  savedResetRef,
  abortControllerRef,
}: {
  debounceRef: MutableRefObject<number | null>;
  savedResetRef: MutableRefObject<number | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
}): void {
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      if (savedResetRef.current !== null) {
        window.clearTimeout(savedResetRef.current);
      }
      if (abortControllerRef.current !== null) {
        abortControllerRef.current.abort();
      }
    };
  }, [abortControllerRef, debounceRef, savedResetRef]);
}

function useOnlineSync(syncOfflineQueue: () => Promise<void>): void {
  useEffect(() => {
    const handleOnline = (): void => {
      console.log('[NoteEditor] Back online - syncing offline queue');
      void syncOfflineQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncOfflineQueue]);
}

export function useNoteEditorPersistence(
  opts: NoteEditorPersistenceOptions,
): NoteEditorPersistenceResult {
  const saveSequenceRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const savedResetRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  usePersistenceCleanup({ debounceRef, savedResetRef, abortControllerRef });

  const [pendingSaveCount, setPendingSaveCount] = useState(() => loadOfflineQueue().length);
  const defaults = useMemo(
    () =>
      buildPersistenceDefaults({
        defaultCourseCode: opts.defaultCourseCode,
        defaultSourceUrl: opts.defaultSourceUrl,
        sourceSelection: opts.sourceSelection,
        defaultWeek: opts.defaultWeek,
      }),
    [opts.defaultCourseCode, opts.defaultSourceUrl, opts.sourceSelection, opts.defaultWeek],
  );

  const { handleContentChange, handleTitleChange, saveNow, resetToNew, syncOfflineQueue } =
    usePersistenceCallbacks({
      notesService: opts.notesService,
      noteRef: opts.noteRef,
      clientNoteIdRef: opts.clientNoteIdRef,
      lastSavedFingerprintRef: opts.lastSavedFingerprintRef,
      saveSequenceRef,
      debounceRef,
      savedResetRef,
      abortControllerRef,
      defaults,
      setPendingSaveCount,
      setNote: opts.setNote,
      setStatus: opts.setStatus,
      setError: opts.setError,
      setActiveNoteId: opts.setActiveNoteId,
    });

  useOnlineSync(syncOfflineQueue);

  return { pendingSaveCount, handleContentChange, handleTitleChange, saveNow, resetToNew, syncOfflineQueue };
}
