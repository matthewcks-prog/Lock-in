import { useCallback, useEffect, useState } from "react";
import type { Note } from "../../core/domain/Note.ts";
import type { NotesService } from "../../core/services/notesService.ts";

interface UseNotesListOptions {
  notesService: NotesService | null | undefined;
  courseCode?: string | null;
  sourceUrl?: string | null;
  limit?: number;
}

export function useNotesList(options: UseNotesListOptions) {
  const { notesService, courseCode, sourceUrl, limit = 50 } = options;
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!notesService) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await notesService.listNotes({
        courseCode: courseCode ?? undefined,
        sourceUrl: sourceUrl ?? undefined,
        limit,
      });
      setNotes(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [courseCode, limit, notesService, sourceUrl]);

  const upsertNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const filtered = prev.filter((item) => item.id !== note.id);
      return [note, ...filtered];
    });
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
  };
}
