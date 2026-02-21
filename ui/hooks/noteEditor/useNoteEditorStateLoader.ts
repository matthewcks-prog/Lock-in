import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { createContentFingerprint } from './noteUtils';
import { resetToDraftIfNeeded } from './noteEditorStateDraft';

interface UseActiveNoteLoaderArgs {
  activeNoteId: string | null;
  noteRef: MutableRefObject<Note | null>;
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null | undefined;
  defaultSourceUrl?: string | null | undefined;
  sourceSelection?: string | null | undefined;
  defaultWeek?: number | null | undefined;
  clientNoteIdRef: MutableRefObject<string>;
  loadingNoteIdRef: MutableRefObject<string | null>;
  lastLoadedNoteIdRef: MutableRefObject<string | null>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

interface LoadNoteArgs {
  targetId: string;
  service: NotesService;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  loadingNoteIdRef: MutableRefObject<string | null>;
  lastLoadedNoteIdRef: MutableRefObject<string | null>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  isCancelled: () => boolean;
}

interface HandleActiveNoteChangeArgs extends UseActiveNoteLoaderArgs {
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null | undefined;
  defaultSourceUrl?: string | null | undefined;
  sourceSelection?: string | null | undefined;
  defaultWeek?: number | null | undefined;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.length > 0) return err.message;
  if (typeof err === 'object' && err !== null) {
    const record = err as Record<string, unknown>;
    if (typeof record['message'] === 'string') return record['message'];
  }
  return fallback;
}

function hasNoteId(noteId: string | null): noteId is string {
  return noteId !== null && noteId.length > 0;
}

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

function shouldSkipLoad({
  targetId,
  loadingNoteId,
  lastLoadedNoteId,
}: {
  targetId: string | null;
  loadingNoteId: string | null;
  lastLoadedNoteId: string | null;
}): boolean {
  if (targetId === loadingNoteId) return true;
  if (hasNoteId(targetId) && targetId === lastLoadedNoteId) return true;
  return false;
}

function syncClientNoteId(
  targetId: string | null,
  clientNoteIdRef: MutableRefObject<string>,
): void {
  if (hasNoteId(targetId)) clientNoteIdRef.current = targetId;
}

async function loadExistingNote({
  targetId,
  service,
  setNote,
  setStatus,
  setError,
  setIsLoading,
  loadingNoteIdRef,
  lastLoadedNoteIdRef,
  lastSavedFingerprintRef,
  isCancelled,
}: LoadNoteArgs): Promise<void> {
  try {
    const loaded = await service.getNote(targetId);
    if (isCancelled()) return;
    setNote(loaded);
    setStatus('idle');
    lastLoadedNoteIdRef.current = targetId;
    lastSavedFingerprintRef.current = createContentFingerprint(loaded.title, loaded.content);
  } catch (err: unknown) {
    if (isCancelled()) return;
    setError(getErrorMessage(err, 'Failed to load note'));
    setStatus('error');
  } finally {
    if (!isCancelled()) {
      loadingNoteIdRef.current = null;
      setIsLoading(false);
    }
  }
}

function startLoad(args: Omit<LoadNoteArgs, 'isCancelled'>): () => void {
  args.loadingNoteIdRef.current = args.targetId;
  args.setIsLoading(true);
  args.setError(null);
  let cancelled = false;

  void loadExistingNote({
    ...args,
    isCancelled: () => cancelled,
  });

  return () => {
    cancelled = true;
  };
}

function isTargetAlreadyHandled(args: HandleActiveNoteChangeArgs): boolean {
  return shouldSkipLoad({
    targetId: args.activeNoteId,
    loadingNoteId: args.loadingNoteIdRef.current,
    lastLoadedNoteId: args.lastLoadedNoteIdRef.current,
  });
}

function handleBlankTarget(args: HandleActiveNoteChangeArgs): boolean {
  if (hasNoteId(args.activeNoteId)) return false;
  resetToDraftIfNeeded({
    currentNote: args.noteRef.current,
    defaultCourseCode: args.defaultCourseCode,
    defaultSourceUrl: args.defaultSourceUrl,
    sourceSelection: args.sourceSelection,
    defaultWeek: args.defaultWeek,
    clientNoteIdRef: args.clientNoteIdRef,
    loadingNoteIdRef: args.loadingNoteIdRef,
    lastLoadedNoteIdRef: args.lastLoadedNoteIdRef,
    lastSavedFingerprintRef: args.lastSavedFingerprintRef,
    setNote: args.setNote,
    setStatus: args.setStatus,
    setIsLoading: args.setIsLoading,
  });
  return true;
}

function handleMissingService(args: HandleActiveNoteChangeArgs): boolean {
  if (args.notesService !== null && args.notesService !== undefined) return false;
  args.loadingNoteIdRef.current = null;
  args.setIsLoading(false);
  return true;
}

function handleActiveNoteChange(args: HandleActiveNoteChangeArgs): (() => void) | void {
  const targetId = args.activeNoteId;
  syncClientNoteId(targetId, args.clientNoteIdRef);
  if (isTargetAlreadyHandled(args)) return;
  if (handleBlankTarget(args)) return;
  if (handleMissingService(args)) return;
  if (!hasNoteId(targetId)) return;
  const service = args.notesService;
  if (service === null || service === undefined) return;

  return startLoad({
    targetId,
    service,
    setNote: args.setNote,
    setStatus: args.setStatus,
    setError: args.setError,
    setIsLoading: args.setIsLoading,
    loadingNoteIdRef: args.loadingNoteIdRef,
    lastLoadedNoteIdRef: args.lastLoadedNoteIdRef,
    lastSavedFingerprintRef: args.lastSavedFingerprintRef,
  });
}

export function useActiveNoteLoader(args: UseActiveNoteLoaderArgs): void {
  const notesServiceRef = useLatestRef(args.notesService);
  const defaultCourseCodeRef = useLatestRef(args.defaultCourseCode);
  const defaultSourceUrlRef = useLatestRef(args.defaultSourceUrl);
  const sourceSelectionRef = useLatestRef(args.sourceSelection);
  const defaultWeekRef = useLatestRef(args.defaultWeek);

  useEffect(() => {
    return handleActiveNoteChange({
      activeNoteId: args.activeNoteId,
      noteRef: args.noteRef,
      notesService: notesServiceRef.current,
      defaultCourseCode: defaultCourseCodeRef.current,
      defaultSourceUrl: defaultSourceUrlRef.current,
      sourceSelection: sourceSelectionRef.current,
      defaultWeek: defaultWeekRef.current,
      clientNoteIdRef: args.clientNoteIdRef,
      loadingNoteIdRef: args.loadingNoteIdRef,
      lastLoadedNoteIdRef: args.lastLoadedNoteIdRef,
      lastSavedFingerprintRef: args.lastSavedFingerprintRef,
      setNote: args.setNote,
      setStatus: args.setStatus,
      setError: args.setError,
      setIsLoading: args.setIsLoading,
    });
  }, [
    args.activeNoteId,
    args.notesService,
    args.noteRef,
    args.clientNoteIdRef,
    args.loadingNoteIdRef,
    args.lastLoadedNoteIdRef,
    args.lastSavedFingerprintRef,
    args.setNote,
    args.setStatus,
    args.setError,
    args.setIsLoading,
    notesServiceRef,
    defaultCourseCodeRef,
    defaultSourceUrlRef,
    sourceSelectionRef,
    defaultWeekRef,
  ]);
}
