import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "../../core/domain/Note.ts";
import type { NotesService } from "../../core/services/notesService.ts";

interface UseNotesListOptions {
  notesService: NotesService | null | undefined;
  courseCode?: string | null;
  sourceUrl?: string | null;
  limit?: number;
}

/**
 * Hook for managing the notes list.
 * 
 * Includes request deduplication to prevent multiple concurrent requests
 * and skips requests if parameters haven't meaningfully changed.
 */
export function useNotesList(options: UseNotesListOptions) {
  const { notesService, courseCode, sourceUrl, limit = 50 } = options;
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track request state to prevent duplicates
  const isRefreshingRef = useRef(false);
  const lastParamsRef = useRef<string>("");

  const refresh = useCallback(async () => {
    if (!notesService) return;
    
    // Create a fingerprint of current params
    const paramsFingerprint = JSON.stringify({ courseCode, sourceUrl, limit });
    
    // Skip if already refreshing with same params
    if (isRefreshingRef.current && lastParamsRef.current === paramsFingerprint) {
      return;
    }
    
    isRefreshingRef.current = true;
    lastParamsRef.current = paramsFingerprint;
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
      isRefreshingRef.current = false;
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
