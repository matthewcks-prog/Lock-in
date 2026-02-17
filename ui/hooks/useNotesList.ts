import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Note } from '../../core/domain/Note.ts';
import type { NotesService } from '../../core/services/notesService.ts';

const DEFAULT_NOTES_LIST_LIMIT = 50;

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

  const errorMessage = err instanceof Error ? err.message : undefined;
  const recordMessage = typeof record?.['message'] === 'string' ? record['message'] : undefined;
  const message =
    errorMessage !== undefined && errorMessage.length > 0 ? errorMessage : recordMessage;

  if (message !== undefined && message.length > 0) {
    meta.message = message;
  }

  return meta;
}

function resolveErrorMessage(meta: { code?: string; message?: string }, fallback: string): string {
  return meta.message !== undefined && meta.message.length > 0 ? meta.message : fallback;
}

function resolveToggleStarErrorMessage(meta: { code?: string; message?: string }): string {
  if (meta.code === 'AUTH_REQUIRED') return 'Please sign in to star notes';
  if (meta.code === 'NOT_FOUND') return 'Note not found';
  if (meta.code === 'NETWORK_ERROR') return 'Network error. Please check your connection.';
  return resolveErrorMessage(meta, 'Failed to toggle star');
}

function restoreDeletedNote(prev: Note[], deletedNote: Note, deletedIndex: number): Note[] {
  const next = [...prev];
  if (deletedIndex >= 0 && deletedIndex <= next.length) {
    next.splice(deletedIndex, 0, deletedNote);
    return next;
  }
  next.unshift(deletedNote);
  return next;
}

interface UseNotesListResult {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upsertNote: (note: Note) => void;
  deleteNote: (noteId: string) => Promise<void>;
  toggleStar: (noteId: string) => Promise<Note | undefined>;
  removeFromList: (noteId: string) => void;
}

function useRefresh({
  notesService,
  limit,
  setNotes,
  setIsLoading,
  setError,
}: {
  notesService: NotesService | null | undefined;
  limit: number;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): () => Promise<void> {
  const isRefreshingRef = useRef(false);
  const lastParamsRef = useRef<string>('');

  return useCallback(async () => {
    if (notesService === null || notesService === undefined) return;

    const paramsFingerprint = JSON.stringify({ limit });
    if (isRefreshingRef.current && lastParamsRef.current === paramsFingerprint) {
      return;
    }

    isRefreshingRef.current = true;
    lastParamsRef.current = paramsFingerprint;
    setIsLoading(true);
    setError(null);

    try {
      const list = await notesService.listNotes({ limit });
      setNotes(list);
    } catch (err: unknown) {
      setError(resolveErrorMessage(getErrorMeta(err), 'Failed to load notes'));
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [limit, notesService, setError, setIsLoading, setNotes]);
}

function useDeleteNote({
  notesService,
  setNotes,
  setError,
}: {
  notesService: NotesService | null | undefined;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): (noteId: string) => Promise<void> {
  return useCallback(
    async (noteId: string): Promise<void> => {
      if (notesService === null || notesService === undefined || noteId.length === 0) return;

      let deletedNote: Note | undefined;
      let deletedIndex = -1;
      setNotes((prev) => {
        deletedIndex = prev.findIndex((note) => note.id === noteId);
        deletedNote = deletedIndex >= 0 ? prev[deletedIndex] : undefined;
        return prev.filter((note) => note.id !== noteId);
      });

      try {
        await notesService.deleteNote(noteId);
      } catch (err: unknown) {
        if (deletedNote !== undefined) {
          setNotes((prev) => restoreDeletedNote(prev, deletedNote!, deletedIndex));
        }
        setError(resolveErrorMessage(getErrorMeta(err), 'Failed to delete note'));
        throw err;
      }
    },
    [notesService, setError, setNotes],
  );
}

function useToggleStar({
  notesService,
  setNotes,
  setError,
}: {
  notesService: NotesService | null | undefined;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): (noteId: string) => Promise<Note | undefined> {
  return useCallback(
    async (noteId: string): Promise<Note | undefined> => {
      if (notesService === null || notesService === undefined) {
        const error = new Error('Notes service not available. Please try again.');
        setError(error.message);
        throw error;
      }
      if (noteId.length === 0) {
        const error = new Error('Cannot star note: Note ID is missing');
        setError(error.message);
        throw error;
      }

      let originalNote: Note | undefined;
      setNotes((prev) =>
        prev.map((note) => {
          if (note.id !== noteId) return note;
          originalNote = note;
          return { ...note, isStarred: note.isStarred !== true };
        }),
      );

      try {
        const updated = await notesService.toggleStar(noteId);
        setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
        return updated;
      } catch (err: unknown) {
        if (originalNote !== undefined) {
          setNotes((prev) => prev.map((note) => (note.id === noteId ? originalNote! : note)));
        }
        setError(resolveToggleStarErrorMessage(getErrorMeta(err)));
        throw err;
      }
    },
    [notesService, setError, setNotes],
  );
}

/**
 * Hook for managing the notes list.
 *
 * Includes request deduplication to prevent multiple concurrent requests
 * and skips requests if parameters haven't meaningfully changed.
 *
 * Provides optimistic updates for delete and star operations.
 */
export function useNotesList(options: UseNotesListOptions): UseNotesListResult {
  const { notesService, limit = DEFAULT_NOTES_LIST_LIMIT } = options;
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useRefresh({ notesService, limit, setNotes, setIsLoading, setError });
  const deleteNote = useDeleteNote({ notesService, setNotes, setError });
  const toggleStar = useToggleStar({ notesService, setNotes, setError });

  const upsertNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const filtered = prev.filter((item) => item.id !== note.id);
      return [note, ...filtered];
    });
  }, []);

  const removeFromList = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  }, []);

  useEffect(() => {
    void refresh();
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
