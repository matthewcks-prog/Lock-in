import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageContext, StudyMode } from "../../core/domain/types";
import type { ApiClient } from "../../api/client";
import { createNotesService } from "../../core/services/notesService.ts";
import type { NotesService } from "../../core/services/notesService.ts";
import { useNotesList } from "../hooks/useNotesList";
import { NotesPanel } from "./notes/NotesPanel";
import { createNoteContentFromPlainText } from "./notes/content";

interface StorageAdapter {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
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

const MODE_OPTIONS: Array<{ value: StudyMode; label: string; hint: string }> = [
  { value: "explain", label: "Explain", hint: "Clarify the selection" },
  { value: "simplify", label: "Simplify", hint: "Make it easier to digest" },
  {
    value: "translate",
    label: "Translate",
    hint: "Switch to another language",
  },
  {
    value: "general",
    label: "General",
    hint: "Ask anything about the content",
  },
];

const CHAT_TAB_ID = "chat";
const NOTES_TAB_ID = "notes";
const SIDEBAR_ACTIVE_TAB_KEY = "lockin_sidebar_activeTab";
const MODE_STORAGE_KEY = "lockinActiveMode";
const SELECTED_NOTE_ID_KEY = "lockin_sidebar_selectedNoteId";
const ACTIVE_CHAT_ID_KEY = "lockin_sidebar_activeChatId";

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
    <div
      className="lockin-mode-selector-container"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="lockin-mode-pill"
        onClick={toggle}
        aria-haspopup="listbox"
      >
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
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  {option.hint}
                </div>
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
  const [activeTab, setActiveTab] = useState<string>(
    activeTabExternal || CHAT_TAB_ID
  );
  const [mode, setMode] = useState<StudyMode>(currentMode);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [recentChats, setRecentChats] = useState<ChatHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [isNoteIdLoaded, setIsNoteIdLoaded] = useState(false);
  const lastForceOpenRef = useRef<number>(0);

  const previousSelectionRef = useRef<string | undefined>();
  const layoutTimeoutRef = useRef<number | null>(null);

  const notesService: NotesService | null = useMemo(
    () => (apiClient ? createNotesService(apiClient) : null),
    [apiClient]
  );

  const courseCode = pageContext?.courseContext.courseCode || null;
  const pageUrl =
    pageContext?.url ||
    (typeof window !== "undefined" ? window.location.href : "");

  const {
    notes,
    isLoading: notesLoading,
    refresh: refreshNotes,
    upsertNote,
  } = useNotesList({
    notesService,
    courseCode,
    sourceUrl: pageUrl,
    limit: 50,
  });

  const applySplitLayout = useCallback((open: boolean) => {
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
  }, []);

  // Handle tab change while preserving page scroll position
  const handleTabChange = useCallback((tabId: string) => {
    // Capture current scroll position before state change
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    setActiveTab(tabId);

    // Restore scroll position after React re-render
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }, []);

  useEffect(() => {
    if (!storage) return;
    storage.get(SIDEBAR_ACTIVE_TAB_KEY).then((tab) => {
      if (tab === CHAT_TAB_ID || tab === NOTES_TAB_ID) {
        setActiveTab(tab);
      }
    });
  }, [storage]);

  // Load selected note ID from storage on mount
  useEffect(() => {
    if (!storage) {
      setIsNoteIdLoaded(true);
      return;
    }
    storage
      .get(SELECTED_NOTE_ID_KEY)
      .then((noteId) => {
        if (noteId && isValidUUID(noteId)) {
          setSelectedNoteId(noteId);
        }
        setIsNoteIdLoaded(true);
      })
      .catch(() => {
        setIsNoteIdLoaded(true);
      });
  }, [storage]);

  // Persist selected note ID when it changes
  useEffect(() => {
    if (!storage || !isNoteIdLoaded) return;
    if (selectedNoteId) {
      storage.set(SELECTED_NOTE_ID_KEY, selectedNoteId).catch(() => {
        /* ignore */
      });
    } else {
      // Clear stored note ID when deselected
      storage.set(SELECTED_NOTE_ID_KEY, null).catch(() => {
        /* ignore */
      });
    }
  }, [selectedNoteId, storage, isNoteIdLoaded]);

  // Load chat ID from storage on mount and restore messages
  useEffect(() => {
    if (!storage) return;
    storage
      .get(ACTIVE_CHAT_ID_KEY)
      .then(async (storedChatId) => {
        if (storedChatId && isValidUUID(storedChatId)) {
          setChatId(storedChatId);
          setActiveHistoryId(storedChatId);

          // Load chat messages for the restored chat
          if (apiClient?.getChatMessages) {
            try {
              const response = await apiClient.getChatMessages(storedChatId);
              if (Array.isArray(response)) {
                const normalized: ChatMessageItem[] = response.map(
                  (message: any) => ({
                    id:
                      message.id ||
                      `msg-${Math.random().toString(16).slice(2)}`,
                    role: message.role === "assistant" ? "assistant" : "user",
                    content:
                      message.content ||
                      message.output_text ||
                      message.input_text ||
                      "Message",
                    timestamp: message.created_at || new Date().toISOString(),
                    mode: (message.mode as StudyMode) || mode,
                  })
                );
                setMessages(normalized);
              }
            } catch {
              // Ignore errors loading messages, user can manually reload
            }
          }
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [storage, apiClient, mode]);

  // Persist chat ID when it changes
  useEffect(() => {
    if (!storage) return;
    if (chatId && isValidUUID(chatId)) {
      storage.set(ACTIVE_CHAT_ID_KEY, chatId).catch(() => {
        /* ignore */
      });
    }
  }, [chatId, storage]);

  useEffect(() => {
    if (!storage) return;
    storage.set(SIDEBAR_ACTIVE_TAB_KEY, activeTab).catch(() => {
      /* ignore */
    });
  }, [activeTab, storage]);

  useEffect(() => {
    if (!storage) return;
    storage.set(MODE_STORAGE_KEY, mode).catch(() => {
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

  useEffect(() => {
    if (isNoteEditing && !isOpen) {
      const now = Date.now();
      // throttle force-open attempts to avoid feedback loops
      if (now - lastForceOpenRef.current > 400) {
        lastForceOpenRef.current = now;
        onToggle();
      }
    }
  }, [isNoteEditing, isOpen, onToggle]);

  const upsertHistory = useCallback(
    (item: ChatHistoryItem, previousId?: string | null) => {
      setRecentChats((prev) => {
        const filtered = prev.filter(
          (history) =>
            history.id !== item.id && (!previousId || history.id !== previousId)
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
        const apiChatId = isValidUUID(chatId) && chatId ? chatId : undefined;
        const response = apiClient?.processText
          ? await apiClient.processText({
              selection: trimmedSelection,
              mode,
              chatHistory: baseHistory,
              newUserMessage,
              chatId: apiChatId,
              pageUrl,
              courseCode: courseCode || undefined,
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
  }, [
    appendSelectionToCurrentChat,
    messages.length,
    selectedText,
    startNewChat,
  ]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!apiClient?.getRecentChats) return;
      try {
        const result = await apiClient.getRecentChats({ limit: 8 });
        if (Array.isArray(result)) {
          const mapped = result.map((item: any) => ({
            id: item.id || `chat-${Math.random().toString(16).slice(2)}`,
            title: item.title || "Conversation",
            updatedAt:
              item.updated_at || item.updatedAt || new Date().toISOString(),
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

  useEffect(() => {
    if (activeTab === NOTES_TAB_ID) {
      refreshNotes();
    }
  }, [activeTab, refreshNotes]);

  const handleHistorySelect = useCallback(
    async (item: ChatHistoryItem) => {
      if (!apiClient?.getChatMessages) return;
      setIsSending(true);
      setChatError(null);
      setActiveHistoryId(item.id);
      setChatId(item.id);

      try {
        const response = await apiClient.getChatMessages(item.id);
        if (Array.isArray(response)) {
          const normalized: ChatMessageItem[] = response.map(
            (message: any) => ({
              id: message.id || `msg-${Math.random().toString(16).slice(2)}`,
              role: message.role === "assistant" ? "assistant" : "user",
              content:
                message.content ||
                message.output_text ||
                message.input_text ||
                "Message",
              timestamp: message.created_at || new Date().toISOString(),
              mode: (message.mode as StudyMode) || mode,
            })
          );
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
    },
    [apiClient, mode]
  );

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isSending) return;
    appendSelectionToCurrentChat(inputValue);
    setInputValue("");
  }, [appendSelectionToCurrentChat, inputValue, isSending]);

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

  const handleSaveAsNote = useCallback(
    async (messageContent: string) => {
      if (!notesService) {
        setActiveTab(NOTES_TAB_ID);
        return;
      }

      try {
        const title =
          messageContent.split("\n")[0].trim().slice(0, 50) || "Untitled note";

        const createdNote = await notesService.createNote({
          title,
          content: createNoteContentFromPlainText(messageContent.trim()),
          sourceUrl: pageUrl,
          courseCode: courseCode || null,
          noteType: "manual",
        });

        upsertNote(createdNote);
        setSelectedNoteId(createdNote.id);
        setActiveTab(NOTES_TAB_ID);
      } catch (error: any) {
        console.error("Failed to save note:", error);
        setActiveTab(NOTES_TAB_ID);
      }
    },
    [courseCode, notesService, pageUrl, upsertNote]
  );

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
                      onClick={() => handleTabChange(tabId)}
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
              x
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

          {activeTab === NOTES_TAB_ID && (
            <NotesPanel
              notesService={notesService}
              notes={notes}
              notesLoading={notesLoading}
              onRefreshNotes={refreshNotes}
              onNoteSaved={(note) => {
                upsertNote(note);
                setSelectedNoteId(note.id);
              }}
              activeNoteId={selectedNoteId}
              onSelectNote={(noteId) => setSelectedNoteId(noteId)}
              courseCode={courseCode}
              pageUrl={pageUrl}
              currentWeek={pageContext?.courseContext?.week}
              onNoteEditingChange={setIsNoteEditing}
            />
          )}
        </div>
      )}
    </>
  );
}
