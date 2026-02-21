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
  defaultWeek?: number | null;
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

function useNoteStateSetup(
  noteId: string | null | undefined,
  options: {
    defaultCourseCode?: string | null | undefined;
    defaultSourceUrl?: string | null | undefined;
    sourceSelection?: string | null | undefined;
    defaultWeek?: number | null | undefined;
  },
): {
  activeNoteId: string | null;
  setActiveNoteId: Dispatch<SetStateAction<string | null>>;
  note: Note | null;
  setNote: Dispatch<SetStateAction<Note | null>>;
  status: NoteStatus;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
} {
  const [activeNoteId, setActiveNoteId] = useSyncedActiveNoteId(noteId);
  const [note, setNote] = useState<Note | null>(() => createDraftNote(buildDraftDefaults(options)));
  const [status, setStatus] = useState<NoteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  return {
    activeNoteId,
    setActiveNoteId,
    note,
    setNote,
    status,
    setStatus,
    error,
    setError,
    isLoading,
    setIsLoading,
  };
}

function useNoteEditorLoader(
  args: {
    notesService: NotesService | null | undefined;
    defaultCourseCode?: string | null | undefined;
    defaultSourceUrl?: string | null | undefined;
    sourceSelection?: string | null | undefined;
    defaultWeek?: number | null | undefined;
  },
  setup: ReturnType<typeof useNoteStateSetup>,
  refs: ReturnType<typeof useNoteEditorRefs>,
): void {
  const { notesService, defaultCourseCode, defaultSourceUrl, sourceSelection, defaultWeek } = args;
  const { activeNoteId, setNote, setStatus, setError, setIsLoading } = setup;
  const {
    noteRef,
    clientNoteIdRef,
    lastSavedFingerprintRef,
    loadingNoteIdRef,
    lastLoadedNoteIdRef,
  } = refs;
  useActiveNoteLoader({
    activeNoteId,
    noteRef,
    notesService,
    defaultCourseCode,
    defaultSourceUrl,
    sourceSelection,
    defaultWeek,
    clientNoteIdRef,
    loadingNoteIdRef,
    lastLoadedNoteIdRef,
    lastSavedFingerprintRef,
    setNote,
    setStatus,
    setError,
    setIsLoading,
  });
}

export function useNoteEditorState(options: NoteEditorStateOptions): NoteEditorStateInternal {
  const {
    noteId,
    notesService,
    defaultCourseCode,
    defaultSourceUrl,
    sourceSelection,
    defaultWeek,
  } = options;
  const setup = useNoteStateSetup(noteId, {
    defaultCourseCode,
    defaultSourceUrl,
    sourceSelection,
    defaultWeek,
  });
  const refs = useNoteEditorRefs(setup.note, noteId);
  useNoteEditorLoader(
    { notesService, defaultCourseCode, defaultSourceUrl, sourceSelection, defaultWeek },
    setup,
    refs,
  );

  return buildNoteEditorStateInternal({
    note: setup.note,
    status: setup.status,
    error: setup.error,
    isLoading: setup.isLoading,
    activeNoteId: setup.activeNoteId,
    setActiveNoteId: setup.setActiveNoteId,
    setNote: setup.setNote,
    setStatus: setup.setStatus,
    setError: setup.setError,
    setIsLoading: setup.setIsLoading,
    noteRef: refs.noteRef,
    clientNoteIdRef: refs.clientNoteIdRef,
    lastSavedFingerprintRef: refs.lastSavedFingerprintRef,
  });
}
