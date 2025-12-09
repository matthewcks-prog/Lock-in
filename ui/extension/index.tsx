/**
 * Lock-in Extension UI Entry Point (Source)
 *
 * React sidebar component + factory exposed as `window.LockInUI`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot, Root } from "react-dom/client";
import type { PageContext, StudyMode } from "../../core/domain/types";

interface StorageAdapter {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
}

interface ApiClient {
  processText?: (params: any) => Promise<any>;
  getRecentChats?: (params?: any) => Promise<any>;
  getChatMessages?: (chatId: string) => Promise<any>;
  [key: string]: any;
}

export interface LockInSidebarProps {
  apiClient: ApiClient | null;
  isOpen: boolean;
  onToggle: () => void;
  currentMode: StudyMode;
  selectedText?: string;
  pageContext?: PageContext;
  adapter?: any;
  storage?: StorageAdapter;
  activeTabExternal?: string;
}

type ChatMessageRole = "user" | "assistant";

interface ChatMessageItem {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  mode?: StudyMode;
  source?: "selection" | "followup";
  isPending?: boolean;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage?: string;
}

interface NoteListItem {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
  courseCode?: string | null;
}

const MODE_OPTIONS: Array<{ value: StudyMode; label: string; hint: string }> =
  [
    { value: "explain", label: "Explain", hint: "Clarify the selection" },
    { value: "simplify", label: "Simplify", hint: "Make it easier to digest" },
    { value: "translate", label: "Translate", hint: "Switch to another language" },
    { value: "general", label: "General", hint: "Ask anything about the content" },
  ];

const CHAT_TAB_ID = "chat";
const NOTES_TAB_ID = "notes";
const SIDEBAR_ACTIVE_TAB_KEY = "lockin_sidebar_activeTab";
const MODE_STORAGE_KEY = "lockinActiveMode";

function isValidUUID(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function relativeLabel(iso: string | null | undefined) {
  if (!iso) return "just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function textSnippet(text: string, length = 80) {
  if (!text) return "Untitled chat";
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

interface SaveNoteActionProps {
  onSaveAsNote: () => void;
}

function SaveNoteAction({ onSaveAsNote }: SaveNoteActionProps) {
  return (
    <div className="lockin-chat-save-note-action">
      <button
        className="lockin-chat-save-note-btn"
        onClick={(e) => {
          e.stopPropagation();
          onSaveAsNote();
        }}
        type="button"
      >
        Save note
      </button>
    </div>
  );
}

function ModeSelector({
  value,
  onSelect,
}: {
  value: StudyMode;
  onSelect: (mode: StudyMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handler = () => setIsOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const current = MODE_OPTIONS.find((option) => option.value === value);

  return (
    <div className="lockin-mode-selector-container" onClick={(e) => e.stopPropagation()}>
      <button className="lockin-mode-pill" onClick={toggle} aria-haspopup="listbox">
        <span className="lockin-mode-icon">*</span>
        <span>{current?.label || "Mode"}</span>
        <span className="lockin-mode-chevron">v</span>
      </button>
      {isOpen && (
        <div className="lockin-mode-expandable" role="listbox">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className="lockin-mode-option"
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
            >
              <span className="lockin-mode-option-icon">
                {option.value === "translate" ? "T" : "-"}
              </span>
              <div>
                <div>{option.label}</div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>{option.hint}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LockInSidebar({
  apiClient,
  isOpen,
  onToggle,
  currentMode,
  selectedText,
  pageContext,
  storage,
  activeTabExternal,
}: LockInSidebarProps) {
  const [activeTab, setActiveTab] = useState<string>(activeTabExternal || CHAT_TAB_ID);
  const [mode, setMode] = useState<StudyMode>(currentMode);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [recentChats, setRecentChats] = useState<ChatHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [notesView, setNotesView] = useState<"current" | "all">("current");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [notesFilter, setNotesFilter] = useState("course");
  const [notesSearch, setNotesSearch] = useState("");
  const layoutTimeoutRef = useRef<number | null>(null);
  const previousSelectionRef = useRef<string | undefined>();

  const courseCode = pageContext?.courseContext.courseCode || null;
  const pageUrl =
    pageContext?.url ||
    (typeof window !== "undefined" ? window.location.href : "");

  const noteLinkedLabel = pageContext?.courseContext.courseCode || "None";

  const filteredNotes = useMemo(() => {
    const searchTerm = notesSearch.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesFilter =
        notesFilter === "all" ||
        (notesFilter === "course" && note.courseCode === courseCode) ||
        (notesFilter === "page" && pageUrl && note.snippet.includes(pageUrl)) ||
        (notesFilter === "starred" && false);
      const matchesSearch =
        !searchTerm ||
        note.title.toLowerCase().includes(searchTerm) ||
        note.snippet.toLowerCase().includes(searchTerm);
      return matchesFilter && matchesSearch;
    });
  }, [courseCode, notes, notesFilter, notesSearch, pageUrl]);

  const applySplitLayout = useCallback(
    (open: boolean) => {
      const body = document.body;
      const html = document.documentElement;
      if (!body || !html) return;
      if (open) {
        body.classList.add("lockin-sidebar-open");
        html.classList.add("lockin-sidebar-transitioning");
      } else {
        body.classList.remove("lockin-sidebar-open");
      }
      if (layoutTimeoutRef.current) {
        window.clearTimeout(layoutTimeoutRef.current);
      }
      layoutTimeoutRef.current = window.setTimeout(() => {
        html.classList.remove("lockin-sidebar-transitioning");
      }, 320);
    },
    []
  );

  useEffect(() => {
    if (!storage) return;
    storage.get(SIDEBAR_ACTIVE_TAB_KEY).then((tab) => {
      if (tab === CHAT_TAB_ID || tab === NOTES_TAB_ID) {
        setActiveTab(tab);
      }
    });
  }, [storage]);

  useEffect(() => {
    if (!storage) return;
    storage
      .set(SIDEBAR_ACTIVE_TAB_KEY, activeTab)
      .catch(() => {
        /* ignore */
      });
  }, [activeTab, storage]);

  useEffect(() => {
    if (!storage) return;
    storage
      .set(MODE_STORAGE_KEY, mode)
      .catch(() => {
        /* ignore */
      });
  }, [mode, storage]);

  useEffect(() => {
    if (!activeTabExternal) return;
    setActiveTab((current) =>
      current === activeTabExternal ? current : activeTabExternal
    );
  }, [activeTabExternal]);

  useEffect(() => {
    applySplitLayout(isOpen);
    return () => {
      applySplitLayout(false);
      if (layoutTimeoutRef.current) {
        window.clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, [applySplitLayout, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }

    return undefined;
  }, [isOpen, onToggle]);

  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  const upsertHistory = useCallback(
    (item: ChatHistoryItem, previousId?: string | null) => {
      setRecentChats((prev) => {
        const filtered = prev.filter(
          (history) =>
            history.id !== item.id &&
            (!previousId || history.id !== previousId)
        );
        return [item, ...filtered].slice(0, 12);
      });
    },
    []
  );

  const triggerProcess = useCallback(
    async ({
      selection,
      newUserMessage,
      chatHistory,
      provisionalChatId,
    }: {
      selection: string;
      newUserMessage?: string;
      chatHistory?: ChatMessageItem[];
      provisionalChatId?: string;
    }) => {
      const trimmedSelection = selection || selectedText || "";
      if (!trimmedSelection && !newUserMessage) return;

      setChatError(null);
      setIsSending(true);
      const pendingId = `assistant-${Date.now()}`;
      const pendingMessage: ChatMessageItem = {
        id: pendingId,
        role: "assistant",
        content: "Thinking...",
        timestamp: new Date().toISOString(),
        mode,
        isPending: true,
      };
      setMessages((prev) => [...prev, pendingMessage]);

      try {
        const baseHistory = (chatHistory || messages).map((message) => ({
          role: message.role,
          content: message.content,
        }));
        const apiChatId = isValidUUID(chatId) ? chatId : undefined;
        const response = apiClient?.processText
          ? await apiClient.processText({
              selection: trimmedSelection,
              mode,
              chatHistory: baseHistory,
              newUserMessage,
              chatId: apiChatId,
              pageUrl,
              courseCode,
            })
          : null;

        const explanation =
          response?.data?.explanation ||
          `(${mode}) ${newUserMessage || trimmedSelection}`;
        const resolvedChatId =
          response?.chatId || chatId || provisionalChatId || null;
        const now = new Date().toISOString();

        setMessages((prev) =>
          prev.map((message) =>
            message.id === pendingId
              ? { ...message, content: explanation, isPending: false }
              : message
          )
        );
        if (resolvedChatId) {
          setChatId(resolvedChatId);
          setActiveHistoryId(resolvedChatId);
          upsertHistory(
            {
              id: resolvedChatId,
              title: textSnippet(newUserMessage || trimmedSelection, 48),
              updatedAt: now,
              lastMessage: explanation,
            },
            provisionalChatId
          );
        }
      } catch (error: any) {
        const fallback =
          error?.message ||
          "We could not process this request. Try again in a moment.";
        setChatError(fallback);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === pendingId
              ? { ...message, content: fallback, isPending: false }
              : message
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      apiClient,
      chatId,
      courseCode,
      messages,
      mode,
      pageUrl,
      selectedText,
      upsertHistory,
    ]
  );

  const startNewChat = useCallback(
    (text: string, source: "selection" | "followup" = "selection") => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const provisionalChatId = `chat-${Date.now()}`;
      const userMessage: ChatMessageItem = {
        id: `${provisionalChatId}-user`,
        role: "user",
        content: trimmed,
        timestamp: now,
        mode,
        source,
      };

      setActiveTab(CHAT_TAB_ID);
      setIsHistoryOpen(false);
      setChatError(null);
      setMessages([userMessage]);
      setChatId(null);
      setActiveHistoryId(provisionalChatId);
      upsertHistory({
        id: provisionalChatId,
        title: textSnippet(trimmed, 48),
        updatedAt: now,
        lastMessage: trimmed,
      });

      triggerProcess({
        selection: trimmed,
        chatHistory: [userMessage],
        provisionalChatId,
      });
    },
    [mode, triggerProcess, upsertHistory]
  );

  const appendSelectionToCurrentChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const userMessage: ChatMessageItem = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: now,
        mode,
        source: "selection",
      };
      const provisionalChatId = isValidUUID(chatId)
        ? (chatId as string)
        : activeHistoryId || `chat-${Date.now()}`;

      setActiveTab(CHAT_TAB_ID);
      setIsHistoryOpen(false);
      setChatError(null);
      setActiveHistoryId(provisionalChatId);

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      upsertHistory({
        id: provisionalChatId,
        title: textSnippet(trimmed, 48),
        updatedAt: now,
        lastMessage: trimmed,
      });

      triggerProcess({
        selection: trimmed,
        newUserMessage: trimmed,
        chatHistory: nextMessages,
        provisionalChatId,
      });
    },
    [activeHistoryId, chatId, messages, mode, triggerProcess, upsertHistory]
  );

  useEffect(() => {
    if (!selectedText || selectedText.trim().length === 0) return;
    if (previousSelectionRef.current === selectedText) return;
    previousSelectionRef.current = selectedText;
    if (messages.length === 0) {
      startNewChat(selectedText, "selection");
    } else {
      appendSelectionToCurrentChat(selectedText);
    }
  }, [appendSelectionToCurrentChat, messages.length, selectedText, startNewChat]);

  const persistNoteDraft = useCallback(
    (draftId?: string) => {
      const now = new Date().toISOString();
      const id = draftId || `note-${Date.now()}`;
      const nextNote: NoteListItem = {
        id,
        title: noteTitle.trim() || "Untitled note",
        snippet: noteContent.trim() || "Write your note here...",
        updatedAt: now,
        courseCode,
      };
      setNotes((prev) => {
        const filtered = prev.filter((note) => note.id !== id);
        return [nextNote, ...filtered];
      });
      setLastSavedAt(now);
      setNoteStatus("saved");
      return id;
    },
    [courseCode, noteContent, noteTitle]
  );

  useEffect(() => {
    if (noteStatus !== "saving") return;
    const timeout = window.setTimeout(() => {
      persistNoteDraft();
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [noteStatus, persistNoteDraft]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!apiClient?.getRecentChats) return;
      try {
        const result = await apiClient.getRecentChats({ limit: 8 });
        if (Array.isArray(result)) {
          const mapped = result.map((item: any) => ({
            id: item.id || `chat-${Math.random().toString(16).slice(2)}`,
            title: item.title || "Conversation",
            updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
            lastMessage: item.lastMessage || "",
          }));
          setRecentChats(mapped);
        }
      } catch {
        // ignore fetch errors, user may be offline
      }
    };
    loadHistory();
  }, [apiClient]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
      mode,
      source: "followup",
    };
    setMessages((prev) => {
      const next = [...prev, userMessage];
      const provisionalChatId = isValidUUID(chatId)
        ? (chatId as string)
        : activeHistoryId ?? undefined;
      triggerProcess({
        selection: selectedText || "",
        newUserMessage: trimmed,
        chatHistory: next,
        provisionalChatId,
      });
      return next;
    });
    setInputValue("");
  };

  const handleHistorySelect = async (item: ChatHistoryItem) => {
    setActiveTab(CHAT_TAB_ID);
    setIsHistoryOpen(false);
    setActiveHistoryId(item.id);
    setChatId(item.id);
    setChatError(null);
    if (!apiClient?.getChatMessages) {
      setMessages([
        {
          id: `history-${item.id}-user`,
          role: "user",
          content: item.title,
          timestamp: item.updatedAt,
          mode,
        },
      ]);
      return;
    }

    setIsSending(true);
    try {
      const response = await apiClient.getChatMessages(item.id);
      if (Array.isArray(response)) {
        const normalized: ChatMessageItem[] = response.map((message: any) => ({
          id: message.id || `msg-${Math.random().toString(16).slice(2)}`,
          role: message.role === "assistant" ? "assistant" : "user",
          content:
            message.content ||
            message.output_text ||
            message.input_text ||
            "Message",
          timestamp: message.created_at || new Date().toISOString(),
          mode: (message.mode as StudyMode) || mode,
        }));
        setMessages(normalized);
      }
    } catch (error: any) {
      setChatError(
        error?.message ||
          "Could not load this conversation. Try refreshing the page."
      );
    } finally {
      setIsSending(false);
    }
  };

  const startBlankChat = () => {
    const now = new Date().toISOString();
    const provisionalChatId = `chat-${Date.now()}`;
    setActiveTab(CHAT_TAB_ID);
    setIsHistoryOpen(false);
    setChatError(null);
    setMessages([]);
    setInputValue("");
    setChatId(null);
    setActiveHistoryId(provisionalChatId);
    upsertHistory({
      id: provisionalChatId,
      title: "New chat",
      updatedAt: now,
      lastMessage: "",
    });
  };

  const handleNewNote = () => {
    setNotesView("current");
    setNoteTitle("");
    setNoteContent("");
    setNoteStatus("saved");
    setLastSavedAt(null);
  };

  const handleSaveAsNote = useCallback(
    async (messageContent: string) => {
      if (!apiClient?.createNote) {
        console.error("createNote API not available");
        return;
      }

      try {
        // Generate a title from the message content (first line or first 50 chars)
        const title = messageContent
          .split("\n")[0]
          .trim()
          .slice(0, 50) || "Untitled note";

        // Create note via API
        const createdNote = await apiClient.createNote({
          title,
          content: messageContent.trim(),
          sourceUrl: pageUrl,
          courseCode: courseCode || null,
          noteType: "manual",
        });

        // Update local notes state
        const now = new Date().toISOString();
        const noteListItem: NoteListItem = {
          id: createdNote.id || `note-${Date.now()}`,
          title: createdNote.title || title,
          snippet: messageContent.trim().slice(0, 80),
          updatedAt: createdNote.updated_at || createdNote.updatedAt || now,
          courseCode: createdNote.course_code || createdNote.courseCode || courseCode || null,
        };

        setNotes((prev) => {
          const filtered = prev.filter((note) => note.id !== noteListItem.id);
          return [noteListItem, ...filtered];
        });

        // Switch to Notes tab and open the note
        setActiveTab(NOTES_TAB_ID);
        setNotesView("current");
        setNoteTitle(noteListItem.title);
        setNoteContent(messageContent.trim());
        setNoteStatus("saved");
        setLastSavedAt(now);

        // Focus the editor after a brief delay to ensure DOM is ready
        setTimeout(() => {
          const editor = document.querySelector(
            ".lockin-note-editor"
          ) as HTMLElement;
          if (editor) {
            editor.focus();
            // Move cursor to end of content
            const range = document.createRange();
            const selection = window.getSelection();
            if (editor.childNodes.length > 0) {
              range.setStart(editor, editor.childNodes.length);
              range.collapse(true);
            } else {
              range.selectNodeContents(editor);
              range.collapse(false);
            }
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }, 150);
      } catch (error: any) {
        console.error("Failed to save note:", error);
        // Still switch to Notes tab and pre-fill, but mark as unsaved
        setActiveTab(NOTES_TAB_ID);
        setNotesView("current");
        setNoteTitle(
          messageContent.split("\n")[0].trim().slice(0, 50) || "Untitled note"
        );
        setNoteContent(messageContent.trim());
        setNoteStatus("idle");
      }
    },
    [apiClient, courseCode, pageUrl]
  );

  const notesFooterLabel = useMemo(() => {
    if (noteStatus === "saving") return "Saving...";
    if (noteStatus === "saved") {
      return lastSavedAt ? `Saved - ${relativeLabel(lastSavedAt)}` : "Saved";
    }
    return "Not saved";
  }, [lastSavedAt, noteStatus]);

  const renderChatMessages = () => {
    if (!messages.length) {
      return (
        <div className="lockin-chat-empty">
          Ask anything about this page to start a new chat.
        </div>
      );
    }

    return messages.map((message) => {
      const roleClass =
        message.role === "assistant"
          ? "lockin-chat-msg lockin-chat-msg-assistant"
          : "lockin-chat-msg lockin-chat-msg-user";
      const bubbleClass =
        message.role === "assistant"
          ? "lockin-chat-bubble"
          : "lockin-chat-bubble";

      return (
        <div key={message.id} className={roleClass}>
          <div
            className={`${bubbleClass}${
              message.isPending ? " lockin-chat-msg-pending" : ""
            }`}
          >
            {message.content}
          </div>
          {message.role === "assistant" && !message.isPending ? (
            <SaveNoteAction
              onSaveAsNote={() => handleSaveAsNote(message.content)}
            />
          ) : null}
        </div>
      );
    });
  };

  const renderNotesView = () => (
    <div className="lockin-notes-container">
      <div className="lockin-notes-shell">
        <div className="lockin-notes-header">
          <div>
            <div className="lockin-notes-heading-title">Notes</div>
            <div className="lockin-notes-heading-subtitle">
              {courseCode ? `Course: ${courseCode}` : "No course detected"}
            </div>
          </div>
          <div className="lockin-notes-toggle">
            <button
              className={`lockin-notes-toggle-btn ${
                notesView === "current" ? "is-active" : ""
              }`}
              onClick={() => setNotesView("current")}
            >
              Current
            </button>
            <button
              className={`lockin-notes-toggle-btn ${
                notesView === "all" ? "is-active" : ""
              }`}
              onClick={() => setNotesView("all")}
            >
              All notes
            </button>
          </div>
          <div className="lockin-notes-actions">
            <button className="lockin-btn-primary" onClick={handleNewNote}>
              + New note
            </button>
          </div>
        </div>

        <div className="lockin-notes-body">
          <div
            className={`lockin-note-current-view ${
              notesView === "current" ? "is-active" : ""
            }`}
          >
            <div className="lockin-note-meta-row">
              <div>
                <span className="lockin-note-link-label">Linked to:</span>
                {noteLinkedLabel ? (
                  <span className="lockin-note-link-target">
                    <a href={pageUrl} target="_blank" rel="noreferrer">
                      {noteLinkedLabel}
                    </a>
                  </span>
                ) : (
                  <span className="lockin-note-link-empty">None</span>
                )}
              </div>
              <div>{notesFooterLabel}</div>
            </div>

            <div className="lockin-note-title-wrap">
              <input
                className="lockin-note-title-input"
                value={noteTitle}
                placeholder="Note title..."
                onChange={(e) => {
                  setNoteTitle(e.target.value);
                  setNoteStatus("saving");
                }}
              />
            </div>

            <div className="lockin-note-toolbar">
              <div className="lockin-note-toolbar-left">
                {["B", "I", "U"].map((tool) => (
                  <button
                    key={tool}
                    className="lockin-note-tool-btn"
                    aria-label={tool}
                  >
                    {tool}
                  </button>
                ))}
                <div className="lockin-note-toolbar-divider" />
                {["*", "1."].map((tool) => (
                  <button
                    key={tool}
                    className="lockin-note-tool-btn"
                    aria-label={tool}
                  >
                    {tool}
                  </button>
                ))}
              </div>
              <div className="lockin-note-toolbar-right">
                <button className="lockin-note-menu-trigger" aria-label="More">
                  ...
                </button>
              </div>
            </div>

            <div className="lockin-note-editor-card">
              <div
                className="lockin-note-editor"
                role="textbox"
                contentEditable
                data-placeholder="Write your note here..."
                onInput={(e) => {
                  setNoteContent((e.target as HTMLElement).innerText || "");
                  setNoteStatus("saving");
                }}
                suppressContentEditableWarning
              >
                {noteContent}
              </div>
            </div>

            <div className="lockin-note-footer-status">{notesFooterLabel}</div>
          </div>

          <div
            className={`lockin-all-notes-view ${
              notesView === "all" ? "is-active" : ""
            }`}
          >
            <div className="lockin-notes-filter-bar">
              <div className="lockin-notes-filter-left">
                <span className="lockin-filter-label">Filter</span>
                <select
                  className="lockin-notes-filter-select"
                  value={notesFilter}
                  onChange={(e) => setNotesFilter(e.target.value)}
                >
                  <option value="page">This page</option>
                  <option value="course">This course</option>
                  <option value="all">All notes</option>
                  <option value="starred">Starred</option>
                </select>
              </div>
              <div className="lockin-notes-search">
                <input
                  className="lockin-notes-search-input"
                  placeholder="Search notes"
                  value={notesSearch}
                  onChange={(e) => setNotesSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="lockin-notes-list">
              {filteredNotes.length === 0 ? (
                <div className="lockin-notes-empty">
                  <div className="lockin-notes-empty-title">No notes yet</div>
                  <div className="lockin-notes-empty-subtitle">
                    Capture a note from the current page to see it here.
                  </div>
                  <button
                    className="lockin-btn-ghost lockin-notes-empty-btn"
                    onClick={() => setNotesView("current")}
                  >
                    Create a note
                  </button>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div key={note.id} className="lockin-note-card">
                    <div className="lockin-note-card-head">
                      <div className="lockin-note-card-title">{note.title}</div>
                      <div className="lockin-note-card-badges">
                        {note.courseCode ? (
                          <span className="lockin-note-badge">
                            {note.courseCode}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="lockin-note-card-snippet">
                      {note.snippet}
                    </div>
                    <div className="lockin-note-card-meta">
                      Updated {relativeLabel(note.updatedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!isOpen && (
        <button
          id="lockin-toggle-pill"
          onClick={onToggle}
          aria-label="Open Lock-in sidebar"
        >
          Lock-in
        </button>
      )}

      {isOpen && (
        <div
          id="lockin-sidebar"
          className="lockin-sidebar"
          data-state={isOpen ? "expanded" : "collapsed"}
        >
          <div className="lockin-top-bar">
            <div className="lockin-top-bar-left">
              <div className="lockin-brand">Lock-in</div>
              <div className="lockin-tabs-wrapper" role="tablist">
                {[CHAT_TAB_ID, NOTES_TAB_ID].map((tabId) => {
                  const label = tabId === CHAT_TAB_ID ? "Chat" : "Notes";
                  const isActive = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      className={`lockin-tab ${
                        isActive ? "lockin-tab-active" : ""
                      }`}
                      onClick={() => setActiveTab(tabId)}
                      role="tab"
                      aria-selected={isActive}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              className="lockin-close-btn"
              onClick={onToggle}
              aria-label="Close sidebar"
            >
              ×
            </button>
          </div>

          {activeTab === CHAT_TAB_ID && (
                <>
                  <div className="lockin-chat-toolbar">
                    <div className="lockin-chat-toolbar-left">
                      <button
                        className="lockin-history-toggle-btn"
                        onClick={() => setIsHistoryOpen((prev) => !prev)}
                        aria-label="Toggle chat history"
                        aria-pressed={isHistoryOpen}
                      >
                        <span
                          className="lockin-history-toggle-icon"
                          aria-hidden="true"
                        >
                          <span className="lockin-history-toggle-line" />
                          <span className="lockin-history-toggle-line" />
                          <span className="lockin-history-toggle-line" />
                        </span>
                        <span className="lockin-sr-only">Toggle chat history</span>
                      </button>
                    </div>
                    <div className="lockin-chat-toolbar-right">
                      <ModeSelector
                        value={mode}
                        onSelect={(newMode) => setMode(newMode)}
                      />
                      <button
                        className="lockin-new-chat-btn"
                        onClick={startBlankChat}
                      >
                        + New chat
                      </button>
                    </div>
                  </div>

                  <div
                    className="lockin-chat-container"
                    data-history-state={isHistoryOpen ? "open" : "closed"}
                  >
                    <aside
                      className="lockin-chat-history-panel"
                      data-state={isHistoryOpen ? "open" : "closed"}
                    >
                      <div className="lockin-history-actions">
                        <span className="lockin-history-label">Chats</span>
                        <button
                          className="lockin-new-chat-btn"
                          onClick={startBlankChat}
                        >
                          + New chat
                        </button>
                      </div>
                      <div className="lockin-history-list">
                        {recentChats.length === 0 ? (
                          <div className="lockin-history-empty">
                            No chats yet. Start from a highlight or a question.
                          </div>
                        ) : (
                          recentChats.map((item) => (
                            <button
                              key={item.id}
                              className={`lockin-history-item ${
                                activeHistoryId === item.id ? "active" : ""
                              }`}
                              onClick={() => handleHistorySelect(item)}
                            >
                              <div className="lockin-history-item-content">
                                <div className="lockin-history-title">
                                  {item.title}
                                </div>
                                <div className="lockin-history-meta">
                                  {relativeLabel(item.updatedAt)}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </aside>

                    <div className="lockin-chat-main">
                      <div className="lockin-chat-content">
                        <div className="lockin-chat-messages-wrapper">
                          <div className="lockin-chat-messages">
                            {renderChatMessages()}
                            {chatError && (
                              <div className="lockin-chat-error">{chatError}</div>
                            )}
                          </div>
                        </div>

                        <div className="lockin-chat-bottom-section">
                          <div className="lockin-chat-input">
                            <textarea
                              className="lockin-chat-input-field"
                              placeholder="Ask a follow-up question..."
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  if (inputValue.trim() && !isSending) {
                                    handleSend();
                                  }
                                }
                              }}
                              rows={1}
                            />
                            <button
                              className="lockin-send-btn"
                              disabled={!inputValue.trim() || isSending}
                              onClick={handleSend}
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
          )}

          {activeTab === NOTES_TAB_ID && renderNotesView()}
        </div>
      )}
    </>
  );
}

export interface SidebarInstance {
  root: Root;
  unmount: () => void;
  updateProps: (newProps: Partial<LockInSidebarProps>) => void;
}

export function createLockInSidebar(
  props: LockInSidebarProps
): SidebarInstance {
  let container = document.getElementById("lockin-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "lockin-root";
    document.body.appendChild(container);
  }

  let currentProps: LockInSidebarProps | null = { ...props };
  const root = createRoot(container);

  const render = () => {
    if (currentProps) {
      root.render(<LockInSidebar {...currentProps} />);
    }
  };

  render();

  return {
    root,
    unmount: () => {
      root.unmount();
      container?.remove();
      currentProps = null;
    },
    updateProps: (newProps: Partial<LockInSidebarProps>) => {
      if (currentProps) {
        currentProps = { ...currentProps, ...newProps };
        render();
      }
    },
  };
}

if (typeof window !== "undefined") {
  (window as any).LockInUI = {
    createLockInSidebar,
    LockInSidebar,
  };
}
