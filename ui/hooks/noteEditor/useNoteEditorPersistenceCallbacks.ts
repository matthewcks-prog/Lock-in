import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Note, NoteContent } from '@core/domain/Note';
import { SAVE_DEBOUNCE_MS } from './constants';
import { createClientNoteId } from './noteUtils';
import { clearTimer, saveNoteToService } from './persistenceUtils';
import { createDraftWithDefaults, resolveDraftBase } from './noteEditorPersistenceHelpers';
import {
  handlePersistError,
  handlePersistSuccess,
  preparePersistAttempt,
} from './persistencePersistFlow';
import { syncOfflineQueueEntries } from './persistenceSyncFlow';
import type {
  UsePersistenceCallbacksOptions,
  UsePersistenceCallbacksResult,
} from './persistenceCallbacksTypes';

function applyDraftUpdate({
  setNote,
  defaults,
  update,
}: {
  setNote: Dispatch<SetStateAction<Note | null>>;
  defaults: UsePersistenceCallbacksOptions['defaults'];
  update: (note: Note) => Note;
}): void {
  setNote((prev) => update(resolveDraftBase(prev, defaults)));
}

function usePersistAction(options: UsePersistenceCallbacksOptions): () => Promise<void> {
  return useCallback(async () => {
    const attempt = preparePersistAttempt(options);
    if (attempt === null) return;

    try {
      const saved = await saveNoteToService({
        notesService: attempt.notesService,
        note: attempt.currentNote,
        clientNoteId: attempt.clientNoteId,
        expectedUpdatedAt: attempt.expectedUpdatedAt,
        controller: attempt.controller,
        defaults: options.defaults,
      });
      handlePersistSuccess({ saved, attempt, ...options });
    } catch (error: unknown) {
      handlePersistError({
        error,
        attempt,
        setPendingSaveCount: options.setPendingSaveCount,
        setError: options.setError,
        setStatus: options.setStatus,
      });
    }
  }, [options]);
}

function useScheduleSave(
  debounceRef: UsePersistenceCallbacksOptions['debounceRef'],
  persist: () => Promise<void>,
): () => void {
  return useCallback(() => {
    clearTimer(debounceRef);
    debounceRef.current = window.setTimeout(() => {
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, [debounceRef, persist]);
}

function useDraftChangeActions({
  defaults,
  setNote,
  setStatus,
  scheduleSave,
}: {
  defaults: UsePersistenceCallbacksOptions['defaults'];
  setNote: UsePersistenceCallbacksOptions['setNote'];
  setStatus: UsePersistenceCallbacksOptions['setStatus'];
  scheduleSave: () => void;
}): Pick<UsePersistenceCallbacksResult, 'handleContentChange' | 'handleTitleChange'> {
  const handleContentChange = useCallback(
    (content: NoteContent) => {
      applyDraftUpdate({ setNote, defaults, update: (note) => ({ ...note, content }) });
      setStatus('editing');
      scheduleSave();
    },
    [defaults, scheduleSave, setNote, setStatus],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      applyDraftUpdate({ setNote, defaults, update: (note) => ({ ...note, title }) });
      setStatus('editing');
      scheduleSave();
    },
    [defaults, scheduleSave, setNote, setStatus],
  );

  return { handleContentChange, handleTitleChange };
}

function useResetAction({
  abortControllerRef,
  clientNoteIdRef,
  debounceRef,
  defaults,
  lastSavedFingerprintRef,
  saveSequenceRef,
  setActiveNoteId,
  setError,
  setNote,
  setStatus,
}: UsePersistenceCallbacksOptions): () => void {
  return useCallback(() => {
    clearTimer(debounceRef);
    abortControllerRef.current?.abort();
    saveSequenceRef.current += 1;
    setActiveNoteId(null);
    clientNoteIdRef.current = createClientNoteId();
    setNote(createDraftWithDefaults(defaults));
    lastSavedFingerprintRef.current = null;
    setStatus('idle');
    setError(null);
  }, [
    abortControllerRef,
    clientNoteIdRef,
    debounceRef,
    defaults,
    lastSavedFingerprintRef,
    saveSequenceRef,
    setActiveNoteId,
    setError,
    setNote,
    setStatus,
  ]);
}

function useSyncOfflineQueueAction(options: UsePersistenceCallbacksOptions): () => Promise<void> {
  return useCallback(async () => {
    await syncOfflineQueueEntries(options);
  }, [options]);
}

export function usePersistenceCallbacks(
  options: UsePersistenceCallbacksOptions,
): UsePersistenceCallbacksResult {
  const persist = usePersistAction(options);
  const scheduleSave = useScheduleSave(options.debounceRef, persist);
  const { handleContentChange, handleTitleChange } = useDraftChangeActions({
    defaults: options.defaults,
    setNote: options.setNote,
    setStatus: options.setStatus,
    scheduleSave,
  });
  const saveNow = useCallback(async () => {
    await persist();
  }, [persist]);
  const resetToNew = useResetAction(options);
  const syncOfflineQueue = useSyncOfflineQueueAction(options);

  return {
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
    syncOfflineQueue,
  };
}
