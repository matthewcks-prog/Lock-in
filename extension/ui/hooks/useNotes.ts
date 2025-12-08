/**
 * React hook for managing notes state and operations
 * 
 * Handles note CRUD operations, filtering, and loading states.
 * Chrome-agnostic - uses API client interface.
 */

import { useState, useCallback, useEffect } from "react";
import type { Note } from "@core/domain/types";
import { normalizeNote, createEmptyNote } from "@core/domain/Note";
import type { ApiClient } from "@api/client";

export type NotesFilter = "page" | "course" | "all" | "starred";
export type NotesViewMode = "current" | "all";

export interface UseNotesOptions {
  apiClient: ApiClient;
  courseCode?: string | null;
  sourceUrl?: string;
}

export interface UseNotesReturn {
  // Current note being edited
  activeNote: Note;
  setActiveNote: (note: Note) => void;
  
  // Notes list
  notes: Note[];
  isLoading: boolean;
  error: Error | null;
  
  // View state
  viewMode: NotesViewMode;
  setViewMode: (mode: NotesViewMode) => void;
  filter: NotesFilter;
  setFilter: (filter: NotesFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Operations
  createNote: () => void;
  saveNote: () => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  duplicateNote: (noteId: string) => Promise<void>;
  loadNotes: () => Promise<void>;
  
  // Status
  saveStatus: string;
  hasChanges: boolean;
}

export function useNotes(options: UseNotesOptions): UseNotesReturn {
  const { apiClient, courseCode, sourceUrl = typeof window !== "undefined" ? window.location.href : "" } = options;

  const [activeNote, setActiveNote] = useState<Note>(createEmptyNote());
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, setViewMode] = useState<NotesViewMode>("current");
  const [filter, setFilter] = useState<NotesFilter>("page");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved · just now");
  const [hasChanges, setHasChanges] = useState(false);

  /**
   * Load notes from API
   */
  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let params: any = { limit: 50 };
      
      if (filter === "page") {
        params.sourceUrl = sourceUrl;
      } else if (filter === "course" && courseCode) {
        params.courseCode = courseCode;
      }
      // "all" and "starred" don't need filters

      const apiNotes = await apiClient.listNotes(params);
      const normalized = Array.isArray(apiNotes)
        ? apiNotes.map((note: any) => normalizeNote(note))
        : [];
      
      setNotes(normalized);
      
      // Sync active note if it exists in the refreshed list
      if (activeNote?.id) {
        const latest = normalized.find((n) => n.id === activeNote.id);
        if (latest) {
          setActiveNote({ ...latest });
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load notes");
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, filter, courseCode, sourceUrl, activeNote.id]);

  /**
   * Create a new empty note
   */
  const createNote = useCallback(() => {
    const newNote = createEmptyNote();
    newNote.sourceUrl = sourceUrl;
    newNote.courseCode = courseCode || null;
    setActiveNote(newNote);
    setHasChanges(false);
    setSaveStatus("Unsaved");
  }, [sourceUrl, courseCode]);

  /**
   * Save the active note
   */
  const saveNote = useCallback(async () => {
    if (!activeNote.content.trim()) {
      setSaveStatus("Cannot save empty note");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (activeNote.id) {
        // Update existing note
        await apiClient.updateNote(activeNote.id, {
          title: activeNote.title,
          content: activeNote.content,
          sourceSelection: activeNote.sourceSelection,
          sourceUrl: activeNote.sourceUrl,
          courseCode: activeNote.courseCode,
          noteType: activeNote.noteType,
          tags: activeNote.tags,
        });
      } else {
        // Create new note
        const created = await apiClient.createNote({
          title: activeNote.title,
          content: activeNote.content,
          sourceSelection: activeNote.sourceSelection,
          sourceUrl: activeNote.sourceUrl,
          courseCode: activeNote.courseCode,
          noteType: activeNote.noteType,
          tags: activeNote.tags,
        });
        
        if (created?.id) {
          setActiveNote({ ...activeNote, id: created.id });
        }
      }
      
      setSaveStatus("Saved · just now");
      setHasChanges(false);
      await loadNotes(); // Refresh list
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to save note");
      setError(error);
      setSaveStatus("Failed to save");
    } finally {
      setIsLoading(false);
    }
  }, [activeNote, apiClient, loadNotes]);

  /**
   * Update a note
   */
  const updateNote = useCallback(
    async (note: Note) => {
      if (!note.id) return;
      
      setIsLoading(true);
      try {
        await apiClient.updateNote(note.id, {
          title: note.title,
          content: note.content,
          sourceSelection: note.sourceSelection,
          sourceUrl: note.sourceUrl,
          courseCode: note.courseCode,
          noteType: note.noteType,
          tags: note.tags,
        });
        await loadNotes();
        if (activeNote.id === note.id) {
          setActiveNote(note);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update note");
        setError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, loadNotes, activeNote.id]
  );

  /**
   * Delete a note
   */
  const deleteNote = useCallback(
    async (noteId: string) => {
      setIsLoading(true);
      try {
        await apiClient.deleteNote(noteId);
        if (activeNote.id === noteId) {
          createNote(); // Reset to empty note
        }
        await loadNotes();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to delete note");
        setError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, loadNotes, activeNote.id, createNote]
  );

  /**
   * Duplicate a note
   */
  const duplicateNote = useCallback(
    async (noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;

      setIsLoading(true);
      try {
        const duplicated = await apiClient.createNote({
          title: `${note.title} (Copy)`,
          content: note.content,
          sourceSelection: note.sourceSelection,
          sourceUrl: note.sourceUrl,
          courseCode: note.courseCode,
          noteType: note.noteType,
          tags: note.tags,
        });
        
        if (duplicated?.id) {
          await loadNotes();
          setActiveNote(normalizeNote(duplicated));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to duplicate note");
        setError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, notes, loadNotes]
  );

  // Load notes when filter changes
  useEffect(() => {
    if (viewMode === "all") {
      loadNotes();
    }
  }, [filter, viewMode]); // Only depend on filter and viewMode

  return {
    activeNote,
    setActiveNote,
    notes,
    isLoading,
    error,
    viewMode,
    setViewMode,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    createNote,
    saveNote,
    updateNote,
    deleteNote,
    duplicateNote,
    loadNotes,
    saveStatus,
    hasChanges,
  };
}
