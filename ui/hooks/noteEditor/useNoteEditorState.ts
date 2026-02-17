import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { createClientNoteId, createDraftNote } from './noteUtils';
import { buildDraftDefaults } from './noteEditorStateDraft';
import { useActiveNoteLoader } from './useNoteEditorStateLoader';

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

interface NoteEditorRefs {
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  loadingNoteIdRef: MutableRefObject<string | null>;
  lastLoadedNoteIdRef: MutableRefObject<string | null>;
}

function buildNoteEditorStateInternal({
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
}: NoteEditorStateInternal): NoteEditorStateInternal {
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

function useSyncedActiveNoteId(
  noteId: string | null | undefined,
): [string | null, Dispatch<SetStateAction<string | null>>] {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(noteId ?? null);
  useEffect(() => {
    setActiveNoteId(noteId ?? null);
  }, [noteId]);
  return [activeNoteId, setActiveNoteId];
}

function useNoteEditorRefs(note: Note | null, noteId: string | null | undefined): NoteEditorRefs {
  const noteRef = useRef(note);
  noteRef.current = note;
  const clientNoteIdRef = useRef<string>(noteId ?? createClientNoteId());
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const loadingNoteIdRef = useRef<string | null>(null);
  const lastLoadedNoteIdRef = useRef<string | null>(null);
  return {
    noteRef,
    clientNoteIdRef,
    lastSavedFingerprintRef,
    loadingNoteIdRef,
    lastLoadedNoteIdRef,
  };
}

export function useNoteEditorState(options: NoteEditorStateOptions): NoteEditorStateInternal {
  const { noteId, notesService, defaultCourseCode, defaultSourceUrl, sourceSelection } = options;
  const [activeNoteId, setActiveNoteId] = useSyncedActiveNoteId(noteId);
  const [note, setNote] = useState<Note | null>(() =>
    createDraftNote(buildDraftDefaults({ defaultCourseCode, defaultSourceUrl, sourceSelection })),
  );
  const [status, setStatus] = useState<NoteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    noteRef,
    clientNoteIdRef,
    lastSavedFingerprintRef,
    loadingNoteIdRef,
    lastLoadedNoteIdRef,
  } = useNoteEditorRefs(note, noteId);

  useActiveNoteLoader({
    activeNoteId,
    noteRef,
    notesService,
    defaultCourseCode,
    defaultSourceUrl,
    sourceSelection,
    clientNoteIdRef,
    loadingNoteIdRef,
    lastLoadedNoteIdRef,
    lastSavedFingerprintRef,
    setNote,
    setStatus,
    setError,
    setIsLoading,
  });

  return buildNoteEditorStateInternal({
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
  });
}
