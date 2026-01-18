import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Note } from '@core/domain/Note';
import type { ToastType } from '@shared/ui/components';

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

export function useNotesPanelActions({
  editorActiveId,
  noteTitle,
  onDeleteNote,
  onToggleStar,
  onNoteSaved,
  onSelectNote,
  resetToNew,
  showToast,
  setView,
}: UseNotesPanelActionsOptions) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [noteToDeleteTitle, setNoteToDeleteTitle] = useState<string>('');

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

  const openDeleteConfirm = useCallback(
    (noteId: string, noteTitleValue: string, event: React.MouseEvent) => {
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

  const executeDelete = useCallback(async () => {
    if (!deleteConfirmId) return;

    try {
      setIsDeleting(deleteConfirmId);
      await onDeleteNote(deleteConfirmId);

      if (editorActiveId === deleteConfirmId) {
        resetToNew();
        onSelectNote(null);
      }

      closeDeleteConfirm();
      showToast('Note deleted', 'success');
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to delete note';
      setDeleteError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('[Lock-in] Delete note failed:', err);
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
    showToast,
  ]);

  const handleToggleStar = useCallback(
    async (noteId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      try {
        const updatedNote = await onToggleStar(noteId);
        if (updatedNote && editorActiveId === noteId) {
          onNoteSaved(updatedNote);
        }

        if (updatedNote?.isStarred) {
          showToast('Note starred', 'star');
        } else {
          showToast('Note unstarred', 'info');
        }
      } catch (err: any) {
        let errorMessage = 'Failed to update star status';
        if (err?.code === 'AUTH_REQUIRED') {
          errorMessage = 'Please sign in to star notes';
        } else if (err?.code === 'NOT_FOUND') {
          errorMessage = 'Note not found';
        } else if (err?.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Check your connection.';
        } else if (err?.message && err.message.length < 60) {
          errorMessage = err.message;
        }
        showToast(errorMessage, 'error');
        console.error('[Lock-in] Toggle star failed:', err);
      }
    },
    [editorActiveId, onNoteSaved, onToggleStar, showToast],
  );

  const handleHeaderToggleStar = useCallback(
    (event: React.MouseEvent) => {
      if (!editorActiveId) return;
      void handleToggleStar(editorActiveId, event);
    },
    [editorActiveId, handleToggleStar],
  );

  const handleHeaderDelete = useCallback(
    (event: React.MouseEvent) => {
      if (!editorActiveId) return;
      openDeleteConfirm(editorActiveId, noteTitle, event);
    },
    [editorActiveId, noteTitle, openDeleteConfirm],
  );

  const clearDeleteError = useCallback(() => {
    setDeleteError(null);
  }, []);

  return {
    deleteConfirmId,
    noteToDeleteTitle,
    deleteError,
    isDeleting,
    openDeleteConfirm,
    closeDeleteConfirm,
    executeDelete,
    handleToggleStar,
    handleHeaderToggleStar,
    handleHeaderDelete,
    handleNewNote,
    handleSelectNote,
    clearDeleteError,
  };
}
