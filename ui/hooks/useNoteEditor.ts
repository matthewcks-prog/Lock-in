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

/**
 * Maximum retry attempts for failed saves
 */
const MAX_SAVE_RETRIES = 3;

/**
 * Local storage key for offline queue
 */
const OFFLINE_QUEUE_KEY = "lockin_offline_notes_queue";

interface PendingSave {
  noteId: string | null;
  clientNoteId: string;
  title: string;
  content: NoteContent;
  courseCode: string | null;
  sourceUrl: string | null;
  sourceSelection: string | null;
  noteType: string;
  tags: string[];
  expectedUpdatedAt: string | null;
  timestamp: number;
  retryCount: number;
}

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

/**
 * Load offline queue from localStorage
 */
function createClientNoteId(): string {
  const globalCrypto =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalCrypto?.getRandomValues) {
    globalCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function getQueueKey(save: PendingSave): string {
  return save.noteId || save.clientNoteId;
}

function normalizeOfflineQueue(queue: PendingSave[]): PendingSave[] {
  const latestByKey = new Map<string, PendingSave>();

  queue.forEach((item) => {
    const normalized: PendingSave = {
      ...item,
      clientNoteId: item.clientNoteId || item.noteId || createClientNoteId(),
      expectedUpdatedAt: item.expectedUpdatedAt ?? null,
      retryCount: item.retryCount ?? 0,
    };
    const key = getQueueKey(normalized);
    const existing = latestByKey.get(key);
    if (!existing || normalized.timestamp >= existing.timestamp) {
      latestByKey.set(key, normalized);
    }
  });

  return Array.from(latestByKey.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );
}

function loadOfflineQueue(): PendingSave[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return normalizeOfflineQueue(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

/**
 * Save offline queue to localStorage
 */
function saveOfflineQueue(queue: PendingSave[]): void {
  try {
    const normalized = normalizeOfflineQueue(queue);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(normalized));
  } catch {
    console.error("[NoteEditor] Failed to save offline queue");
  }
}

/**
 * Add a pending save to the offline queue
 */
function addToOfflineQueue(save: PendingSave): void {
  const queue = loadOfflineQueue();
  // Remove any existing entry for the same note (we only need the latest)
  const key = getQueueKey(save);
  const filtered = queue.filter((s) => getQueueKey(s) !== key);
  // Keep only the most recent for this note
  filtered.push(save);
  // Limit queue size to prevent storage bloat
  const trimmed = filtered.slice(-50);
  saveOfflineQueue(trimmed);
}

/**
 * Remove a pending save from the offline queue
 */
function removeFromOfflineQueue(queueKey: string): void {
  const queue = loadOfflineQueue();
  const filtered = queue.filter((s) => getQueueKey(s) !== queueKey);
  saveOfflineQueue(filtered);
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

  const noteRef = useRef(note);
  noteRef.current = note;
  const clientNoteIdRef = useRef<string>(noteId ?? createClientNoteId());
  const saveSequenceRef = useRef(0);
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
    const currentNote = noteRef.current;

    if (targetId) {
      clientNoteIdRef.current = targetId;
    }
    
    // Skip if we're already loading this note or it's already loaded
    if (targetId === loadingNoteIdRef.current) {
      return;
    }
    if (targetId === lastLoadedNoteIdRef.current && targetId !== null) {
      return;
    }
    
    if (!targetId) {
      loadingNoteIdRef.current = null;
      lastLoadedNoteIdRef.current = null;
      if (!currentNote || currentNote.id !== null) {
        clientNoteIdRef.current = createClientNoteId();
        const draft = createDraftNote({
          courseCode: defaultCourseCodeRef.current,
          sourceUrl: defaultSourceUrlRef.current,
          sourceSelection: sourceSelectionRef.current,
        });
        setNote(draft);
        // Set fingerprint for the initial draft to prevent unnecessary save on first change
        lastSavedFingerprintRef.current = createContentFingerprint(draft.title, draft.content);
      }
      setStatus("idle");
      setIsLoading(false);
      return;
    }

    if (!service) {
      loadingNoteIdRef.current = null;
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
  }, [activeNoteId, notesService]);

  /**
   * Persist the current note to the backend.
   * Uses a ref to always access the latest note state, avoiding stale closures.
   * 
   * Scalability considerations:
   * - Fingerprint check prevents unnecessary API calls when content hasn't changed
   * - AbortController cancels in-flight saves if a new save is triggered
   * - Debouncing in scheduleSave limits API calls to ~40/minute max per user
   * - Offline queue for failed saves with automatic retry
   */
  // Track offline queue state
  const [pendingSaveCount, setPendingSaveCount] = useState(() => loadOfflineQueue().length);

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

    const clientNoteId = currentNote.id || clientNoteIdRef.current || createClientNoteId();
    if (!currentNote.id) {
      clientNoteIdRef.current = clientNoteId;
    }
    const expectedUpdatedAt = currentNote.updatedAt ?? null;
    const queueKey = currentNote.id || clientNoteId;
    const saveSequence = ++saveSequenceRef.current;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus("saving");
    setError(null);
    
    // Create pending save for offline queue
    const pendingSave: PendingSave = {
      noteId: currentNote.id,
      clientNoteId,
      title: currentNote.title || "Untitled note",
      content: currentNote.content,
      courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
      sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
      sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
      noteType: currentNote.noteType,
      tags: currentNote.tags,
      expectedUpdatedAt,
      timestamp: Date.now(),
      retryCount: 0,
    };

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
        saved = await notesService.updateNote(currentNote.id, payload, {
          signal: controller.signal,
          expectedUpdatedAt,
        });
      } else {
        const payload: CreateNoteInput = {
          title: currentNote.title || "Untitled note",
          content: currentNote.content,
          courseCode: currentNote.courseCode ?? defaultCourseCode ?? null,
          sourceUrl: currentNote.sourceUrl ?? defaultSourceUrl ?? null,
          sourceSelection: currentNote.sourceSelection ?? sourceSelection ?? null,
          noteType: currentNote.noteType,
          tags: currentNote.tags,
          clientNoteId,
        };
        saved = await notesService.createNote(payload, {
          signal: controller.signal,
        });
      }

      // Check if this save was aborted while in progress
      if (controller.signal.aborted) return;
      if (saveSequence !== saveSequenceRef.current) return;

      const latestNote = noteRef.current;
      if (latestNote?.id && saved.id && latestNote.id !== saved.id) {
        return;
      }
      if (!latestNote?.id && clientNoteIdRef.current !== clientNoteId) {
        return;
      }
      const latestFingerprint = latestNote
        ? createContentFingerprint(latestNote.title, latestNote.content)
        : null;
      if (latestFingerprint && latestFingerprint !== fingerprint) {
        setStatus("editing");
        return;
      }

      removeFromOfflineQueue(queueKey);
      setPendingSaveCount(loadOfflineQueue().length);

      setNote(saved);
      setActiveNoteId(saved.id);
      if (saved.id) {
        clientNoteIdRef.current = saved.id;
      }
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
      if (controller.signal.aborted || err?.code === "ABORTED") return;
      
      // Check if this is a network error or retryable error
      const isNetworkError = err?.code === "NETWORK_ERROR" || !navigator.onLine;
      const isRetryable = isNetworkError || err?.code === "RATE_LIMIT" || err?.status === 429 || err?.status >= 500;
      
      if (isRetryable && pendingSave.retryCount < MAX_SAVE_RETRIES) {
        // Add to offline queue for later retry
        addToOfflineQueue(pendingSave);
        setPendingSaveCount(loadOfflineQueue().length);
        setError(isNetworkError ? "Saved offline - will sync when connected" : "Save queued for retry");
        setStatus("error");
      } else {
        setError(err?.message || "Failed to save note");
        setStatus("error");
      }
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
    saveSequenceRef.current += 1;
    setActiveNoteId(null);
    clientNoteIdRef.current = createClientNoteId();
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

  /**
   * Sync offline queue - process any pending saves that failed due to network issues.
   * Called automatically when coming back online, or manually by the user.
   */
  const syncOfflineQueue = useCallback(async () => {
    if (!notesService) return;
    
    const queue = loadOfflineQueue();
    if (queue.length === 0) return;
    
    console.log(`[NoteEditor] Syncing ${queue.length} offline saves`);
    
    for (const pendingSave of queue) {
      const queueKey = getQueueKey(pendingSave);
      try {
        let saved: Note | null = null;
        if (pendingSave.noteId) {
          // Update existing note
          const payload: UpdateNoteInput = {
            title: pendingSave.title,
            content: pendingSave.content,
            courseCode: pendingSave.courseCode,
            sourceUrl: pendingSave.sourceUrl,
            sourceSelection: pendingSave.sourceSelection,
            noteType: pendingSave.noteType as any,
            tags: pendingSave.tags,
          };
          saved = await notesService.updateNote(pendingSave.noteId, payload, {
            expectedUpdatedAt: pendingSave.expectedUpdatedAt ?? undefined,
          });
        } else {
          // Create new note
          const payload: CreateNoteInput = {
            title: pendingSave.title,
            content: pendingSave.content,
            courseCode: pendingSave.courseCode,
            sourceUrl: pendingSave.sourceUrl,
            sourceSelection: pendingSave.sourceSelection,
            noteType: pendingSave.noteType as any,
            tags: pendingSave.tags,
            clientNoteId: pendingSave.clientNoteId,
          };
          saved = await notesService.createNote(payload);
        }
        
        // Successfully saved - remove from queue
        removeFromOfflineQueue(queueKey);
        console.log(`[NoteEditor] Synced offline save for note ${pendingSave.noteId || pendingSave.clientNoteId || 'new'}`);

        if (saved) {
          const latestNote = noteRef.current;
          const pendingFingerprint = createContentFingerprint(
            pendingSave.title,
            pendingSave.content
          );
          const latestFingerprint = latestNote
            ? createContentFingerprint(latestNote.title, latestNote.content)
            : null;
          const isSameDraft =
            !latestNote?.id &&
            clientNoteIdRef.current === pendingSave.clientNoteId;
          const isSameNote = latestNote?.id && latestNote.id === saved.id;

          if ((isSameDraft || isSameNote) && latestFingerprint === pendingFingerprint) {
            setNote(saved);
            setActiveNoteId(saved.id);
            if (saved.id) {
              clientNoteIdRef.current = saved.id;
            }
            lastSavedFingerprintRef.current = createContentFingerprint(
              saved.title,
              saved.content
            );
            setStatus("saved");
            if (savedResetRef.current) {
              window.clearTimeout(savedResetRef.current);
            }
            savedResetRef.current = window.setTimeout(() => setStatus("idle"), SAVED_RESET_DELAY_MS);
          }
        }
      } catch (err: any) {
        console.error(`[NoteEditor] Failed to sync offline save:`, err);
        const isRetryable =
          err?.code === "NETWORK_ERROR" ||
          err?.code === "RATE_LIMIT" ||
          err?.status === 429 ||
          err?.status >= 500;
        const isStale =
          err?.code === "CONFLICT" || err?.code === "NOT_FOUND";
        
        // Increment retry count
        const queue = loadOfflineQueue();
        const updated = queue.map((s) =>
          getQueueKey(s) === queueKey
            ? { ...s, retryCount: (s.retryCount ?? 0) + 1 }
            : s
        );
        let filtered = updated.filter((s) => s.retryCount < MAX_SAVE_RETRIES);
        if (!isRetryable || isStale) {
          filtered = filtered.filter((s) => getQueueKey(s) !== queueKey);
        }
        saveOfflineQueue(filtered);
      }
    }
    
    setPendingSaveCount(loadOfflineQueue().length);
  }, [notesService]);

  // Sync offline queue when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log("[NoteEditor] Back online - syncing offline queue");
      void syncOfflineQueue();
    };
    
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineQueue]);

  return {
    note,
    status,
    error,
    isLoading,
    activeNoteId,
    pendingSaveCount,
    setActiveNoteId,
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
    syncOfflineQueue,
  };
}
