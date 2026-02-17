import { useCallback, useState } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';
import type { Note } from '@core/domain/Note';
import type { ToastType } from '@shared/ui/components';

const MAX_INLINE_ERROR_MESSAGE_LENGTH = 60;
const DELETE_NOTE_FAILED_MESSAGE = 'Failed to delete note';
const STAR_UPDATE_FAILED_MESSAGE = 'Failed to update star status';

type UnknownRecord = Record<string, unknown>;

export interface UseNotesPanelActionsOptions {
  editorActiveId: string | null;
  noteTitle: string;
  onDeleteNote: (noteId: string) => Promise<void>;
  onToggleStar: (noteId: string) => Promise<Note | undefined>;
  onNoteSaved: (note: Note) => void;
  onSelectNote: (noteId: string | null) => void;
  resetToNew: () => void;
  showToast: (message: string, type?: ToastType) => void;
  setView: Dispatch<SetStateAction<'current' | 'all'>>;
}

export interface UseNotesPanelActionsResult {
  deleteConfirmId: string | null;
  noteToDeleteTitle: string;
  deleteError: string | null;
  isDeleting: string | null;
  openDeleteConfirm: (noteId: string, noteTitleValue: string, event: ReactMouseEvent) => void;
  closeDeleteConfirm: () => void;
  executeDelete: () => Promise<void>;
  handleToggleStar: (noteId: string, event: ReactMouseEvent) => Promise<void>;
  handleHeaderToggleStar: (event: ReactMouseEvent) => void;
  handleHeaderDelete: (event: ReactMouseEvent) => void;
  handleNewNote: () => void;
  handleSelectNote: (noteId: string | null) => void;
  clearDeleteError: () => void;
}

interface UseDeleteExecutionArgs {
  deleteConfirmId: string | null;
  editorActiveId: string | null;
  onDeleteNote: (noteId: string) => Promise<void>;
  onSelectNote: (noteId: string | null) => void;
  resetToNew: () => void;
  closeDeleteConfirm: () => void;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setIsDeleting: Dispatch<SetStateAction<string | null>>;
  showToast: (message: string, type?: ToastType) => void;
}

interface UseToggleStarActionArgs {
  editorActiveId: string | null;
  onToggleStar: (noteId: string) => Promise<Note | undefined>;
  onNoteSaved: (note: Note) => void;
  showToast: (message: string, type?: ToastType) => void;
}

interface UseNavigationActionsArgs {
  onSelectNote: (noteId: string | null) => void;
  resetToNew: () => void;
  setView: Dispatch<SetStateAction<'current' | 'all'>>;
}

interface UseHeaderActionsArgs {
  editorActiveId: string | null;
  noteTitle: string;
  handleToggleStar: UseNotesPanelActionsResult['handleToggleStar'];
  openDeleteConfirm: UseNotesPanelActionsResult['openDeleteConfirm'];
}

interface UseDeleteConfirmStateResult {
  deleteConfirmId: string | null;
  noteToDeleteTitle: string;
  deleteError: string | null;
  isDeleting: string | null;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setIsDeleting: Dispatch<SetStateAction<string | null>>;
  openDeleteConfirm: (noteId: string, noteTitleValue: string, event: ReactMouseEvent) => void;
  closeDeleteConfirm: () => void;
  clearDeleteError: () => void;
}

function toUnknownRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function toNonEmptyMessage(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  const fromError = error instanceof Error ? toNonEmptyMessage(error.message) : undefined;
  if (fromError !== undefined) return fromError;
  return toNonEmptyMessage(toUnknownRecord(error)?.['message']);
}

function getToggleStarErrorMessage(error: unknown): string {
  const code = toUnknownRecord(error)?.['code'];
  if (code === 'AUTH_REQUIRED') return 'Please sign in to star notes';
  if (code === 'NOT_FOUND') return 'Note not found';
  if (code === 'NETWORK_ERROR') return 'Network error. Check your connection.';

  const message = getErrorMessage(error);
  if (message !== undefined && message.length < MAX_INLINE_ERROR_MESSAGE_LENGTH) return message;
  return STAR_UPDATE_FAILED_MESSAGE;
}

function useDeleteConfirmState(): UseDeleteConfirmStateResult {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [noteToDeleteTitle, setNoteToDeleteTitle] = useState<string>('');

  const openDeleteConfirm = useCallback(
    (noteId: string, noteTitleValue: string, event: ReactMouseEvent) => {
      event.stopPropagation();
      setDeleteConfirmId(noteId);
      setNoteToDeleteTitle(noteTitleValue);
    },
    [],
  );
  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmId(null);
    setNoteToDeleteTitle('');
  }, []);
  const clearDeleteError = useCallback(() => setDeleteError(null), []);

  return {
    deleteConfirmId,
    noteToDeleteTitle,
    deleteError,
    isDeleting,
    setDeleteError,
    setIsDeleting,
    openDeleteConfirm,
    closeDeleteConfirm,
    clearDeleteError,
  };
}

function useDeleteExecution(args: UseDeleteExecutionArgs): () => Promise<void> {
  const {
    deleteConfirmId,
    editorActiveId,
    onDeleteNote,
    onSelectNote,
    resetToNew,
    closeDeleteConfirm,
    setDeleteError,
    setIsDeleting,
    showToast,
  } = args;

  return useCallback(async () => {
    if (deleteConfirmId === null || deleteConfirmId.length === 0) return;

    try {
      setIsDeleting(deleteConfirmId);
      await onDeleteNote(deleteConfirmId);
      if (editorActiveId === deleteConfirmId) {
        resetToNew();
        onSelectNote(null);
      }
      closeDeleteConfirm();
      showToast('Note deleted', 'success');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error) ?? DELETE_NOTE_FAILED_MESSAGE;
      setDeleteError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('[Lock-in] Delete note failed:', error);
    } finally {
      setIsDeleting(null);
    }
  }, [
    closeDeleteConfirm,
    deleteConfirmId,
    editorActiveId,
    onDeleteNote,
    onSelectNote,
    resetToNew,
    setDeleteError,
    setIsDeleting,
    showToast,
  ]);
}

function useToggleStarAction(
  args: UseToggleStarActionArgs,
): UseNotesPanelActionsResult['handleToggleStar'] {
  const { editorActiveId, onToggleStar, onNoteSaved, showToast } = args;

  return useCallback(
    async (noteId: string, event: ReactMouseEvent) => {
      event.stopPropagation();
      try {
        const updatedNote = await onToggleStar(noteId);
        if (updatedNote !== undefined && editorActiveId === noteId) onNoteSaved(updatedNote);

        const isStarred = updatedNote?.isStarred === true;
        showToast(isStarred ? 'Note starred' : 'Note unstarred', isStarred ? 'star' : 'info');
      } catch (error: unknown) {
        const errorMessage = getToggleStarErrorMessage(error);
        showToast(errorMessage, 'error');
        console.error('[Lock-in] Toggle star failed:', error);
      }
    },
    [editorActiveId, onNoteSaved, onToggleStar, showToast],
  );
}

function useNavigationActions(
  args: UseNavigationActionsArgs,
): Pick<UseNotesPanelActionsResult, 'handleNewNote' | 'handleSelectNote'> {
  const { onSelectNote, resetToNew, setView } = args;
  const handleNewNote = useCallback(() => {
    resetToNew();
    onSelectNote(null);
    setView('current');
  }, [onSelectNote, resetToNew, setView]);

  const handleSelectNote = useCallback(
    (noteId: string | null) => {
      onSelectNote(noteId);
      setView('current');
    },
    [onSelectNote, setView],
  );
  return { handleNewNote, handleSelectNote };
}

function useHeaderActions(
  args: UseHeaderActionsArgs,
): Pick<UseNotesPanelActionsResult, 'handleHeaderToggleStar' | 'handleHeaderDelete'> {
  const { editorActiveId, noteTitle, handleToggleStar, openDeleteConfirm } = args;

  const handleHeaderToggleStar = useCallback(
    (event: ReactMouseEvent) => {
      if (editorActiveId === null || editorActiveId.length === 0) return;
      void handleToggleStar(editorActiveId, event);
    },
    [editorActiveId, handleToggleStar],
  );

  const handleHeaderDelete = useCallback(
    (event: ReactMouseEvent) => {
      if (editorActiveId === null || editorActiveId.length === 0) return;
      openDeleteConfirm(editorActiveId, noteTitle, event);
    },
    [editorActiveId, noteTitle, openDeleteConfirm],
  );
  return { handleHeaderToggleStar, handleHeaderDelete };
}

export function useNotesPanelActions(
  options: UseNotesPanelActionsOptions,
): UseNotesPanelActionsResult {
  const deleteState = useDeleteConfirmState();
  const executeDelete = useDeleteExecution({
    deleteConfirmId: deleteState.deleteConfirmId,
    editorActiveId: options.editorActiveId,
    onDeleteNote: options.onDeleteNote,
    onSelectNote: options.onSelectNote,
    resetToNew: options.resetToNew,
    closeDeleteConfirm: deleteState.closeDeleteConfirm,
    setDeleteError: deleteState.setDeleteError,
    setIsDeleting: deleteState.setIsDeleting,
    showToast: options.showToast,
  });
  const handleToggleStar = useToggleStarAction({
    editorActiveId: options.editorActiveId,
    onToggleStar: options.onToggleStar,
    onNoteSaved: options.onNoteSaved,
    showToast: options.showToast,
  });
  const navigationActions = useNavigationActions({
    onSelectNote: options.onSelectNote,
    resetToNew: options.resetToNew,
    setView: options.setView,
  });
  const headerActions = useHeaderActions({
    editorActiveId: options.editorActiveId,
    noteTitle: options.noteTitle,
    handleToggleStar,
    openDeleteConfirm: deleteState.openDeleteConfirm,
  });

  return {
    deleteConfirmId: deleteState.deleteConfirmId,
    noteToDeleteTitle: deleteState.noteToDeleteTitle,
    deleteError: deleteState.deleteError,
    isDeleting: deleteState.isDeleting,
    openDeleteConfirm: deleteState.openDeleteConfirm,
    closeDeleteConfirm: deleteState.closeDeleteConfirm,
    executeDelete,
    handleToggleStar,
    handleHeaderToggleStar: headerActions.handleHeaderToggleStar,
    handleHeaderDelete: headerActions.handleHeaderDelete,
    handleNewNote: navigationActions.handleNewNote,
    handleSelectNote: navigationActions.handleSelectNote,
    clearDeleteError: deleteState.clearDeleteError,
  };
}
