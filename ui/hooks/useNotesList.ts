import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note } from '../../core/domain/Note.ts';
import type { NotesService } from '../../core/services/notesService.ts';

interface UseNotesListOptions {
  notesService: NotesService | null | undefined;
  limit?: number;
}

function getErrorMeta(err: unknown): { code?: string; message?: string } {
  const record = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : null;
  const meta: { code?: string; message?: string } = {};
  if (typeof record?.['code'] === 'string') {
    meta.code = record['code'];
  }
  const message =
    (err instanceof Error && err.message) ||
    (typeof record?.['message'] === 'string' ? record['message'] : undefined);
  if (message) {
    meta.message = message;
  }
  return meta;
}

/**
 * Hook for managing the notes list.
 *
 * Includes request deduplication to prevent multiple concurrent requests
 * and skips requests if parameters haven't meaningfully changed.
 *
 * Provides optimistic updates for delete and star operations.
 */
export function useNotesList(options: UseNotesListOptions) {
  const { notesService, limit = 50 } = options;
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track request state to prevent duplicates
  const isRefreshingRef = useRef(false);
  const lastParamsRef = useRef<string>('');

  const refresh = useCallback(async () => {
    if (!notesService) return;

    // Create a fingerprint of current params (only limit matters now)
    const paramsFingerprint = JSON.stringify({ limit });

    // Skip if already refreshing with same params
    if (isRefreshingRef.current && lastParamsRef.current === paramsFingerprint) {
      return;
    }

    isRefreshingRef.current = true;
    lastParamsRef.current = paramsFingerprint;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch ALL notes for the user (no courseCode/sourceUrl filters)
      // Client-side filtering will handle course/starred filters
      const list = await notesService.listNotes({
        limit,
      });
      setNotes(list);
    } catch (err: unknown) {
      const meta = getErrorMeta(err);
      setError(meta.message || 'Failed to load notes');
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [limit, notesService]);

  const upsertNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const filtered = prev.filter((item) => item.id !== note.id);
      return [note, ...filtered];
    });
  }, []);

  /**
   * Delete a note with optimistic update.
   * Removes the note from the list immediately, then calls the backend.
   * If the backend call fails, the note is restored.
   */
  const deleteNote = useCallback(
    async (noteId: string): Promise<void> => {
      if (!notesService || !noteId) return;

      // Store the note for potential rollback
      let deletedNote: Note | undefined;
      let deletedIndex: number = -1;

      // Optimistic update: remove from list immediately
      setNotes((prev) => {
        deletedIndex = prev.findIndex((n) => n.id === noteId);
        if (deletedIndex >= 0) {
          deletedNote = prev[deletedIndex];
        }
        return prev.filter((n) => n.id !== noteId);
      });

      try {
        await notesService.deleteNote(noteId);
      } catch (err: unknown) {
        // Rollback: restore the note if delete failed
        if (deletedNote) {
          setNotes((prev) => {
            // Insert back at original position if possible
            const newList = [...prev];
            if (deletedIndex >= 0 && deletedIndex <= newList.length) {
              newList.splice(deletedIndex, 0, deletedNote!);
            } else {
              newList.unshift(deletedNote!);
            }
            return newList;
          });
        }
        const meta = getErrorMeta(err);
        setError(meta.message || 'Failed to delete note');
        throw err;
      }
    },
    [notesService],
  );

  /**
   * Toggle the starred status of a note with optimistic update.
   * Updates the UI immediately, then syncs with the backend.
   * If the backend call fails, the change is reverted.
   */
  const toggleStar = useCallback(
    async (noteId: string): Promise<Note | undefined> => {
      if (!notesService) {
        const error = new Error('Notes service not available. Please try again.');
        setError(error.message);
        throw error;
      }

      if (!noteId) {
        const error = new Error('Cannot star note: Note ID is missing');
        setError(error.message);
        throw error;
      }

      // Store the original state for potential rollback
      let originalNote: Note | undefined;

      // Optimistic update: toggle starred immediately
      setNotes((prev) => {
        return prev.map((n) => {
          if (n.id === noteId) {
            originalNote = n;
            return { ...n, isStarred: !n.isStarred };
          }
          return n;
        });
      });

      try {
        const updated = await notesService.toggleStar(noteId);
        // Update with the server response to ensure consistency
        setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
        return updated;
      } catch (err: unknown) {
        const meta = getErrorMeta(err);
        // Rollback: restore the original state if toggle failed
        if (originalNote) {
          setNotes((prev) => prev.map((n) => (n.id === noteId ? originalNote! : n)));
        }

        // Provide more specific error messages based on error type
        let errorMessage = 'Failed to toggle star';
        if (meta.code === 'AUTH_REQUIRED') {
          errorMessage = 'Please sign in to star notes';
        } else if (meta.code === 'NOT_FOUND') {
          errorMessage = 'Note not found';
        } else if (meta.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your connection.';
        } else if (meta.message) {
          errorMessage = meta.message;
        }

        setError(errorMessage);
        throw err;
      }
    },
    [notesService],
  );

  /**
   * Remove a note from the list without calling the backend.
   * Useful when deletion is triggered elsewhere.
   */
  const removeFromList = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    notes,
    isLoading,
    error,
    refresh,
    upsertNote,
    deleteNote,
    toggleStar,
    removeFromList,
  };
}
