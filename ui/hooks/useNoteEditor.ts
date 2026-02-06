import type { Note, NoteContent, NoteStatus } from '../../core/domain/Note.ts';
import type { NotesService } from '../../core/services/notesService.ts';
import { useNoteEditorPersistence } from './noteEditor/useNoteEditorPersistence';
import { useNoteEditorState } from './noteEditor/useNoteEditorState';

interface UseNoteEditorOptions {
  noteId?: string | null;
  notesService: NotesService | null | undefined;
  defaultCourseCode?: string | null;
  defaultSourceUrl?: string | null;
  sourceSelection?: string | null;
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

export function useNoteEditor(options: UseNoteEditorOptions): UseNoteEditorResult {
  const state = useNoteEditorState(options);
  const persistenceOptions: {
    notesService: NotesService | null | undefined;
    defaultCourseCode?: string | null;
    defaultSourceUrl?: string | null;
    sourceSelection?: string | null;
    noteRef: typeof state.noteRef;
    clientNoteIdRef: typeof state.clientNoteIdRef;
    lastSavedFingerprintRef: typeof state.lastSavedFingerprintRef;
    setNote: typeof state.setNote;
    setStatus: typeof state.setStatus;
    setError: typeof state.setError;
    setActiveNoteId: typeof state.setActiveNoteId;
  } = {
    notesService: options.notesService,
    noteRef: state.noteRef,
    clientNoteIdRef: state.clientNoteIdRef,
    lastSavedFingerprintRef: state.lastSavedFingerprintRef,
    setNote: state.setNote,
    setStatus: state.setStatus,
    setError: state.setError,
    setActiveNoteId: state.setActiveNoteId,
  };
  if (options.defaultCourseCode !== undefined) {
    persistenceOptions.defaultCourseCode = options.defaultCourseCode;
  }
  if (options.defaultSourceUrl !== undefined) {
    persistenceOptions.defaultSourceUrl = options.defaultSourceUrl;
  }
  if (options.sourceSelection !== undefined) {
    persistenceOptions.sourceSelection = options.sourceSelection;
  }
  const persistence = useNoteEditorPersistence(persistenceOptions);

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
