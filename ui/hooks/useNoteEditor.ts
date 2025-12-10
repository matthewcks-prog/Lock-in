import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteContent, NoteStatus } from "../../core/domain/Note.ts";
import type {
  CreateNoteInput,
  NotesService,
  UpdateNoteInput,
} from "../../core/services/notesService.ts";

const SAVE_DEBOUNCE_MS = 1500;
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

  const loadNote = useCallback(
    async (targetId: string | null) => {
      if (!targetId || !notesService) {
        setNote(
          createDraftNote({
            courseCode: defaultCourseCode,
            sourceUrl: defaultSourceUrl,
            sourceSelection,
          })
        );
        setStatus("idle");
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const loaded = await notesService.getNote(targetId);
        setNote(loaded);
        lastSavedFingerprintRef.current = createContentFingerprint(
          loaded.title,
          loaded.content
        );
        setStatus("idle");
      } catch (err: any) {
        setError(err?.message || "Failed to load note");
        setStatus("error");
      } finally {
        setIsLoading(false);
      }
    },
    [defaultCourseCode, defaultSourceUrl, notesService, sourceSelection]
  );

  useEffect(() => {
    loadNote(activeNoteId);
  }, [activeNoteId, loadNote]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const persist = useCallback(async () => {
    if (!notesService || !note) {
      setError("Notes service unavailable");
      setStatus("error");
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (status === "saving") {
      abortControllerRef.current?.abort();
    }

    const fingerprint = createContentFingerprint(note.title, note.content);
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
      if (note.id) {
        const payload: UpdateNoteInput = {
          title: note.title,
          content: note.content,
          courseCode: note.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: note.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: note.sourceSelection ?? sourceSelection ?? null,
          noteType: note.noteType,
          tags: note.tags,
        };
        saved = await notesService.updateNote(note.id, payload);
      } else {
        const payload: CreateNoteInput = {
          title: note.title || "Untitled note",
          content: note.content,
          courseCode: note.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: note.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: note.sourceSelection ?? sourceSelection ?? null,
          noteType: note.noteType,
          tags: note.tags,
        };
        saved = await notesService.createNote(payload);
      }

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
  }, [
    defaultCourseCode,
    defaultSourceUrl,
    note,
    notesService,
    sourceSelection,
    status,
  ]);

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
    }
    abortControllerRef.current?.abort();
    setActiveNoteId(null);
    const draft = createDraftNote({
      courseCode: defaultCourseCode,
      sourceUrl: defaultSourceUrl,
      sourceSelection,
    });
    setNote(draft);
    setStatus("idle");
    setError(null);
  }, [defaultCourseCode, defaultSourceUrl, sourceSelection]);

  const resultStatus: NoteStatus = useMemo(() => status, [status]);

  return {
    note,
    status: resultStatus,
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
