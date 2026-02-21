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

export function useNoteEditor(options: UseNoteEditorOptions): UseNoteEditorResult {
  const state = useNoteEditorState(options);
  const persistenceOpts: Parameters<typeof useNoteEditorPersistence>[0] = {
    notesService: options.notesService,
    noteRef: state.noteRef,
    clientNoteIdRef: state.clientNoteIdRef,
    lastSavedFingerprintRef: state.lastSavedFingerprintRef,
    setNote: state.setNote,
    setStatus: state.setStatus,
    setError: state.setError,
    setActiveNoteId: state.setActiveNoteId,
  };
  if (options.defaultCourseCode !== undefined)
    persistenceOpts.defaultCourseCode = options.defaultCourseCode;
  if (options.defaultSourceUrl !== undefined)
    persistenceOpts.defaultSourceUrl = options.defaultSourceUrl;
  if (options.sourceSelection !== undefined)
    persistenceOpts.sourceSelection = options.sourceSelection;
  if (options.defaultWeek !== undefined) persistenceOpts.defaultWeek = options.defaultWeek;
  const persistence = useNoteEditorPersistence(persistenceOpts);

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
