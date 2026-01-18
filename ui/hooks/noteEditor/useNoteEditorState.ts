import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { createClientNoteId, createContentFingerprint, createDraftNote } from './noteUtils';

export interface NoteEditorStateOptions {
  noteId?: string | null;
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null;
  defaultSourceUrl?: string | null;
  sourceSelection?: string | null;
}

export interface NoteEditorState {
  note: Note | null;
  status: NoteStatus;
  error: string | null;
  isLoading: boolean;
  activeNoteId: string | null;
  setActiveNoteId: (noteId: string | null) => void;
}

export interface NoteEditorStateInternal extends NoteEditorState {
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
}

export function useNoteEditorState({
  noteId,
  notesService,
  defaultCourseCode,
  defaultSourceUrl,
  sourceSelection,
}: NoteEditorStateOptions): NoteEditorStateInternal {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(noteId ?? null);
  const [note, setNote] = useState<Note | null>(
    createDraftNote({
      courseCode: defaultCourseCode,
      sourceUrl: defaultSourceUrl,
      sourceSelection,
    }),
  );
  const [status, setStatus] = useState<NoteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const noteRef = useRef(note);
  noteRef.current = note;
  const clientNoteIdRef = useRef<string>(noteId ?? createClientNoteId());
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const loadingNoteIdRef = useRef<string | null>(null);
  const lastLoadedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveNoteId(noteId ?? null);
  }, [noteId]);

  // Load note when activeNoteId changes
  // Uses refs for dependencies to avoid re-running on every render
  const notesServiceRef = useRef(notesService);
  notesServiceRef.current = notesService;
  const defaultCourseCodeRef = useRef(defaultCourseCode);
  defaultCourseCodeRef.current = defaultCourseCode;
  const defaultSourceUrlRef = useRef(defaultSourceUrl);
  defaultSourceUrlRef.current = defaultSourceUrl;
  const sourceSelectionRef = useRef(sourceSelection);
  sourceSelectionRef.current = sourceSelection;

  useEffect(() => {
    const targetId = activeNoteId;
    const service = notesServiceRef.current;
    const currentNote = noteRef.current;

    if (targetId) {
      clientNoteIdRef.current = targetId;
    }

    // Skip if we're already loading this note or it's already loaded
    if (targetId === loadingNoteIdRef.current) {
      return;
    }
    if (targetId === lastLoadedNoteIdRef.current && targetId !== null) {
      return;
    }

    if (!targetId) {
      loadingNoteIdRef.current = null;
      lastLoadedNoteIdRef.current = null;
      if (!currentNote || currentNote.id !== null) {
        clientNoteIdRef.current = createClientNoteId();
        const draft = createDraftNote({
          courseCode: defaultCourseCodeRef.current,
          sourceUrl: defaultSourceUrlRef.current,
          sourceSelection: sourceSelectionRef.current,
        });
        setNote(draft);
        // Set fingerprint for the initial draft to prevent unnecessary save on first change
        lastSavedFingerprintRef.current = createContentFingerprint(draft.title, draft.content);
      }
      setStatus('idle');
      setIsLoading(false);
      return;
    }

    if (!service) {
      loadingNoteIdRef.current = null;
      setIsLoading(false);
      return;
    }

    loadingNoteIdRef.current = targetId;
    setIsLoading(true);
    setError(null);

    let cancelled = false;

    (async () => {
      try {
        const loaded = await service.getNote(targetId);
        if (cancelled) return;

        setNote(loaded);
        lastSavedFingerprintRef.current = createContentFingerprint(loaded.title, loaded.content);
        lastLoadedNoteIdRef.current = targetId;
        setStatus('idle');
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load note');
        setStatus('error');
      } finally {
        if (!cancelled) {
          loadingNoteIdRef.current = null;
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeNoteId, notesService]);

  return {
    note,
    status,
    error,
    isLoading,
    activeNoteId,
    setActiveNoteId,
    setNote,
    setStatus,
    setError,
    setIsLoading,
    noteRef,
    clientNoteIdRef,
    lastSavedFingerprintRef,
  };
}
