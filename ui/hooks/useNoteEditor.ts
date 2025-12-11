import { useCallback, useEffect, useRef, useState } from "react";
import type { Note, NoteContent, NoteStatus } from "../../core/domain/Note.ts";
import type {
  CreateNoteInput,
  NotesService,
  UpdateNoteInput,
} from "../../core/services/notesService.ts";

/**
 * Autosave debounce delay (ms).
 * 1500ms is a good balance between responsiveness and reducing API calls.
 * For thousands of users, this means ~40 saves/minute max per active user.
 */
const SAVE_DEBOUNCE_MS = 1500;

/**
 * How long to show "Saved" status before returning to idle.
 */
const SAVED_RESET_DELAY_MS = 1200;

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
  setActiveNoteId: (noteId: string | null) => void;
  handleContentChange: (content: NoteContent) => void;
  handleTitleChange: (title: string) => void;
  saveNow: () => Promise<void>;
  resetToNew: () => void;
}

function createDraftNote(opts: {
  courseCode?: string | null;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
}): Note {
  return {
    id: null,
    title: "",
    content: {
      version: "lexical_v1",
      editorState: null,
      legacyHtml: null,
      plainText: "",
    },
    sourceUrl: opts.sourceUrl ?? null,
    sourceSelection: opts.sourceSelection ?? null,
    courseCode: opts.courseCode ?? null,
    noteType: "manual",
    tags: [],
    createdAt: null,
    updatedAt: null,
    linkedLabel: opts.courseCode ?? undefined,
    isStarred: false,
    previewText: "",
  };
}

function createContentFingerprint(title: string, content: NoteContent): string {
  return JSON.stringify({
    title: title.trim(),
    content: content.editorState,
    version: content.version,
    legacy: content.legacyHtml,
    plainText: content.plainText,
  });
}

export function useNoteEditor(options: UseNoteEditorOptions): UseNoteEditorResult {
  const { notesService, noteId, defaultCourseCode, defaultSourceUrl, sourceSelection } =
    options;

  const [activeNoteId, setActiveNoteId] = useState<string | null>(noteId ?? null);
  const [note, setNote] = useState<Note | null>(
    createDraftNote({ courseCode: defaultCourseCode, sourceUrl: defaultSourceUrl, sourceSelection })
  );
  const [status, setStatus] = useState<NoteStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const savedResetRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  // Track which note ID we're currently loading to prevent duplicate requests
  const loadingNoteIdRef = useRef<string | null>(null);
  const lastLoadedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveNoteId(noteId ?? null);
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      if (savedResetRef.current) {
        window.clearTimeout(savedResetRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load note when activeNoteId changes
  // Uses refs for dependencies to avoid re-running on every render
  const notesServiceRef = useRef(notesService);
  notesServiceRef.current = notesService;
  const defaultCourseCodeRef = useRef(defaultCourseCode);
  defaultCourseCodeRef.current = defaultCourseCode;
  const defaultSourceUrlRef = useRef(defaultSourceUrl);
  defaultSourceUrlRef.current = defaultSourceUrl;
  const sourceSelectionRef = useRef(sourceSelection);
  sourceSelectionRef.current = sourceSelection;

  useEffect(() => {
    const targetId = activeNoteId;
    const service = notesServiceRef.current;
    
    // Skip if we're already loading this note or it's already loaded
    if (targetId === loadingNoteIdRef.current) {
      return;
    }
    if (targetId === lastLoadedNoteIdRef.current && targetId !== null) {
      return;
    }
    
    if (!targetId || !service) {
      loadingNoteIdRef.current = null;
      lastLoadedNoteIdRef.current = null;
      setNote(
        createDraftNote({
          courseCode: defaultCourseCodeRef.current,
          sourceUrl: defaultSourceUrlRef.current,
          sourceSelection: sourceSelectionRef.current,
        })
      );
      setStatus("idle");
      setIsLoading(false);
      return;
    }

    loadingNoteIdRef.current = targetId;
    setIsLoading(true);
    setError(null);
    
    let cancelled = false;
    
    (async () => {
      try {
        const loaded = await service.getNote(targetId);
        if (cancelled) return;
        
        setNote(loaded);
        lastSavedFingerprintRef.current = createContentFingerprint(
          loaded.title,
          loaded.content
        );
        lastLoadedNoteIdRef.current = targetId;
        setStatus("idle");
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load note");
        setStatus("error");
      } finally {
        if (!cancelled) {
          loadingNoteIdRef.current = null;
          setIsLoading(false);
        }
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, [activeNoteId]);

  /**
   * Persist the current note to the backend.
   * Uses a ref to always access the latest note state, avoiding stale closures.
   * 
   * Scalability considerations:
   * - Fingerprint check prevents unnecessary API calls when content hasn't changed
   * - AbortController cancels in-flight saves if a new save is triggered
   * - Debouncing in scheduleSave limits API calls to ~40/minute max per user
   */
  const noteRef = useRef(note);
  noteRef.current = note;

  const persist = useCallback(async () => {
    const currentNote = noteRef.current;
    
    if (!notesService || !currentNote) {
      setError("Notes service unavailable");
      setStatus("error");
      return;
    }

    // Clear any pending debounced saves
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Cancel any in-flight save request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Skip save if content hasn't changed since last save
    const fingerprint = createContentFingerprint(currentNote.title, currentNote.content);
    if (fingerprint === lastSavedFingerprintRef.current) {
      setStatus("saved");
      if (savedResetRef.current) {
        window.clearTimeout(savedResetRef.current);
      }
      savedResetRef.current = window.setTimeout(() => setStatus("idle"), SAVED_RESET_DELAY_MS);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus("saving");
    setError(null);

    try {
      let saved: Note;
      if (currentNote.id) {
        const payload: UpdateNoteInput = {
          title: currentNote.title,
          content: currentNote.content,
          courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
          noteType: currentNote.noteType,
          tags: currentNote.tags,
        };
        saved = await notesService.updateNote(currentNote.id, payload);
      } else {
        const payload: CreateNoteInput = {
          title: currentNote.title || "Untitled note",
          content: currentNote.content,
          courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
          noteType: currentNote.noteType,
          tags: currentNote.tags,
        };
        saved = await notesService.createNote(payload);
      }

      // Check if this save was aborted while in progress
      if (controller.signal.aborted) return;

      setNote(saved);
      setActiveNoteId(saved.id);
      lastSavedFingerprintRef.current = createContentFingerprint(
        saved.title,
        saved.content
      );
      setStatus("saved");
      if (savedResetRef.current) {
        window.clearTimeout(savedResetRef.current);
      }
      savedResetRef.current = window.setTimeout(() => setStatus("idle"), SAVED_RESET_DELAY_MS);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setError(err?.message || "Failed to save note");
      setStatus("error");
    }
  }, [defaultCourseCode, defaultSourceUrl, notesService, sourceSelection]);

  /**
   * Schedule a debounced save.
   * The debounce prevents excessive API calls during rapid typing.
   * At 1500ms debounce, this limits to ~40 saves/minute even if user types continuously.
   */
  const scheduleSave = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  const handleContentChange = useCallback(
    (content: NoteContent) => {
      setNote((prev) => {
        const base = prev ?? createDraftNote({
          courseCode: defaultCourseCode,
          sourceUrl: defaultSourceUrl,
          sourceSelection,
        });
        return { ...base, content };
      });
      setStatus("editing");
      scheduleSave();
    },
    [defaultCourseCode, defaultSourceUrl, scheduleSave, sourceSelection]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      setNote((prev) => {
        const base = prev ?? createDraftNote({
          courseCode: defaultCourseCode,
          sourceUrl: defaultSourceUrl,
          sourceSelection,
        });
        return { ...base, title };
      });
      setStatus("editing");
      scheduleSave();
    },
    [defaultCourseCode, defaultSourceUrl, scheduleSave, sourceSelection]
  );

  const saveNow = useCallback(async () => {
    await persist();
  }, [persist]);

  const resetToNew = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    abortControllerRef.current?.abort();
    setActiveNoteId(null);
    const draft = createDraftNote({
      courseCode: defaultCourseCode,
      sourceUrl: defaultSourceUrl,
      sourceSelection,
    });
    setNote(draft);
    lastSavedFingerprintRef.current = null;
    setStatus("idle");
    setError(null);
  }, [defaultCourseCode, defaultSourceUrl, sourceSelection]);

  return {
    note,
    status,
    error,
    isLoading,
    activeNoteId,
    setActiveNoteId,
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
  };
}
