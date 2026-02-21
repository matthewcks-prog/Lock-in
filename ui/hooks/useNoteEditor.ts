import type { Note, NoteContent, NoteStatus } from '../../core/domain/Note.ts';
import type { NotesService } from '../../core/services/notesService.ts';
import {
  useNoteEditorPersistence,
  type NoteEditorPersistenceOptions,
} from './noteEditor/useNoteEditorPersistence';
import { useNoteEditorState } from './noteEditor/useNoteEditorState';

interface UseNoteEditorOptions {
  noteId?: string | null;
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null;
  defaultSourceUrl?: string | null;
  sourceSelection?: string | null;
  defaultWeek?: number | null;
}

export interface UseNoteEditorResult {
  note: Note | null;
  status: NoteStatus;
  error: string | null;
  isLoading: boolean;
  activeNoteId: string | null;
  /** Number of notes queued for offline sync */
  pendingSaveCount: number;
  setActiveNoteId: (noteId: string | null) => void;
  handleContentChange: (content: NoteContent) => void;
  handleTitleChange: (title: string) => void;
  saveNow: () => Promise<void>;
  resetToNew: () => void;
  /** Manually trigger sync of offline queue */
  syncOfflineQueue: () => Promise<void>;
}

function buildPersistenceOptions(
  options: UseNoteEditorOptions,
  state: ReturnType<typeof useNoteEditorState>,
): NoteEditorPersistenceOptions {
  const opts: NoteEditorPersistenceOptions = {
    notesService: options.notesService,
    noteRef: state.noteRef,
    clientNoteIdRef: state.clientNoteIdRef,
    lastSavedFingerprintRef: state.lastSavedFingerprintRef,
    setNote: state.setNote,
    setStatus: state.setStatus,
    setError: state.setError,
    setActiveNoteId: state.setActiveNoteId,
  };
  if (options.defaultCourseCode !== undefined) opts.defaultCourseCode = options.defaultCourseCode;
  if (options.defaultSourceUrl !== undefined) opts.defaultSourceUrl = options.defaultSourceUrl;
  if (options.sourceSelection !== undefined) opts.sourceSelection = options.sourceSelection;
  if (options.defaultWeek !== undefined) opts.defaultWeek = options.defaultWeek;
  return opts;
}

export function useNoteEditor(options: UseNoteEditorOptions): UseNoteEditorResult {
  const state = useNoteEditorState(options);
  const persistence = useNoteEditorPersistence(buildPersistenceOptions(options, state));

  return {
    note: state.note,
    status: state.status,
    error: state.error,
    isLoading: state.isLoading,
    activeNoteId: state.activeNoteId,
    pendingSaveCount: persistence.pendingSaveCount,
    setActiveNoteId: state.setActiveNoteId,
    handleContentChange: persistence.handleContentChange,
    handleTitleChange: persistence.handleTitleChange,
    saveNow: persistence.saveNow,
    resetToNew: persistence.resetToNew,
    syncOfflineQueue: persistence.syncOfflineQueue,
  };
}
