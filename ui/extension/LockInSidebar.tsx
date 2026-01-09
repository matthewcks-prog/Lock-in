import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PageContext, StudyMode } from '../../core/domain/types';
import type { ApiClient } from '../../api/client';
import { createNotesService } from '../../core/services/notesService.ts';
import type { NotesService } from '../../core/services/notesService.ts';
import { useNotesList } from '../hooks/useNotesList';
import { NotesPanel } from './notes/NotesPanel';
import { createNoteContentFromPlainText } from './notes/content';
import { ToolProvider, useToolContext, StudyToolsDropdown, getToolById } from './tools';

interface StorageAdapter {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  getLocal?: (key: string) => Promise<any>;
  setLocal?: (key: string, value: any) => Promise<void>;
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

type ChatMessageRole = 'user' | 'assistant';

interface ChatMessageItem {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  mode?: StudyMode;
  source?: 'selection' | 'followup';
  isPending?: boolean;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage?: string;
}

type HistoryTitleSource = 'local' | 'server';

const MODE_OPTIONS: Array<{ value: StudyMode; label: string; hint: string }> = [
  { value: 'explain', label: 'Explain', hint: 'Clarify the selection' },
  {
    value: 'general',
    label: 'General',
    hint: 'Ask anything about the content',
  },
];

const CHAT_TAB_ID = 'chat';
const NOTES_TAB_ID = 'notes';
const TOOL_TAB_ID = 'tool';
const SIDEBAR_ACTIVE_TAB_KEY = 'lockin_sidebar_activeTab';
const MODE_STORAGE_KEY = 'lockinActiveMode';
const SELECTED_NOTE_ID_KEY = 'lockin_sidebar_selectedNoteId';
const ACTIVE_CHAT_ID_KEY = 'lockin_sidebar_activeChatId';
const SIDEBAR_WIDTH_KEY = 'lockin_sidebar_width';
const SIDEBAR_OPEN_KEY = 'lockin_sidebar_isOpen';
const SIDEBAR_MIN_WIDTH = 360;
const SIDEBAR_MAX_WIDTH = 1500;
const SIDEBAR_MAX_VW = 0.75;
const CHAT_TITLE_MAX_WORDS = 6;
const CHAT_TITLE_MAX_LENGTH = 80;
const FALLBACK_CHAT_TITLE = 'New chat';

function isValidUUID(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function relativeLabel(iso: string | null | undefined) {
  if (!iso) return 'just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function clampChatTitle(text = '') {
  const normalized = normalizeSpaces(text);
  if (!normalized) return '';

  const limitedWords = normalized.split(' ').slice(0, CHAT_TITLE_MAX_WORDS).join(' ').trim();

  if (limitedWords.length <= CHAT_TITLE_MAX_LENGTH) {
    return limitedWords;
  }

  return limitedWords.slice(0, CHAT_TITLE_MAX_LENGTH).trim();
}

function coerceChatTitle(candidate?: string | null, fallback?: string) {
  const normalizedCandidate = clampChatTitle(candidate || '');
  if (normalizedCandidate) return normalizedCandidate;

  const normalizedFallback = clampChatTitle(fallback || '');
  return normalizedFallback || FALLBACK_CHAT_TITLE;
}

function buildInitialChatTitle(text: string) {
  return coerceChatTitle(text, FALLBACK_CHAT_TITLE);
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
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const current = MODE_OPTIONS.find((option) => option.value === value);

  return (
    <div className="lockin-mode-selector-container" onClick={(e) => e.stopPropagation()}>
      <button className="lockin-mode-pill" onClick={toggle} aria-haspopup="listbox">
        <span className="lockin-mode-icon">*</span>
        <span>{current?.label || 'Mode'}</span>
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
              <span className="lockin-mode-option-icon">-</span>
              <div>
                <div>{option.label}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{option.hint}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LockInSidebarContent({
  apiClient,
  isOpen,
  onToggle,
  currentMode,
  selectedText,
  pageContext,
  storage,
  activeTabExternal,
}: LockInSidebarProps) {
  // Tool context for Study Tools integration
  const { activeToolId, activeToolTitle, closeTool } = useToolContext();

  const [activeTab, setActiveTab] = useState<string>(activeTabExternal || CHAT_TAB_ID);
  const [mode, setMode] = useState<StudyMode>(currentMode);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [recentChats, setRecentChats] = useState<ChatHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [isNoteIdLoaded, setIsNoteIdLoaded] = useState(false);
  const lastForceOpenRef = useRef<number>(0);

  const previousSelectionRef = useRef<string | undefined>();
  const layoutTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isResizingRef = useRef(false);
  const resizeRafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const currentWidthRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const getMaxSidebarWidth = useCallback(() => {
    if (typeof window === 'undefined') return SIDEBAR_MAX_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.floor(window.innerWidth * SIDEBAR_MAX_VW));
  }, []);

  const clampSidebarWidth = useCallback(
    (width: number) => {
      const maxWidth = getMaxSidebarWidth();
      const minWidth = Math.min(SIDEBAR_MIN_WIDTH, maxWidth);
      return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
    },
    [getMaxSidebarWidth],
  );

  const applySidebarWidth = useCallback(
    (width: number) => {
      if (typeof document === 'undefined') return;
      const clamped = clampSidebarWidth(width);
      currentWidthRef.current = clamped;
      document.documentElement.style.setProperty('--lockin-sidebar-width', `${clamped}px`);
    },
    [clampSidebarWidth],
  );

  const notesService: NotesService | null = useMemo(
    () => (apiClient ? createNotesService(apiClient) : null),
    [apiClient],
  );

  const courseCode = pageContext?.courseContext.courseCode || null;
  const pageUrl = pageContext?.url || (typeof window !== 'undefined' ? window.location.href : '');

  const {
    notes,
    isLoading: notesLoading,
    refresh: refreshNotes,
    upsertNote,
    deleteNote: deleteNoteFromList,
    toggleStar: toggleNoteStar,
  } = useNotesList({
    notesService,
    limit: 50,
  });

  const applySplitLayout = useCallback((open: boolean) => {
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;
    if (open) {
      body.classList.add('lockin-sidebar-open');
      html.classList.add('lockin-sidebar-transitioning');
    } else {
      body.classList.remove('lockin-sidebar-open');
    }
    if (layoutTimeoutRef.current) {
      window.clearTimeout(layoutTimeoutRef.current);
    }
    layoutTimeoutRef.current = window.setTimeout(() => {
      html.classList.remove('lockin-sidebar-transitioning');
    }, 320);
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (typeof window === 'undefined') return;
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      const pointerId = event.pointerId;

      const updateWidth = (clientX: number) => {
        const nextWidth = window.innerWidth - clientX;
        pendingWidthRef.current = nextWidth;
        if (resizeRafRef.current !== null) return;
        resizeRafRef.current = window.requestAnimationFrame(() => {
          resizeRafRef.current = null;
          if (pendingWidthRef.current === null) return;
          applySidebarWidth(pendingWidthRef.current);
          pendingWidthRef.current = null;
        });
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isResizingRef.current) return;
        updateWidth(moveEvent.clientX);
      };

      const stopResize = () => {
        if (!isResizingRef.current) return;
        isResizingRef.current = false;
        resizeCleanupRef.current = null;

        if (handle.hasPointerCapture?.(pointerId)) {
          handle.releasePointerCapture?.(pointerId);
        }

        document.documentElement.classList.remove('lockin-sidebar-resizing');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', stopResize);
        window.removeEventListener('pointercancel', stopResize);

        if (resizeRafRef.current !== null) {
          window.cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = null;
        }

        if (pendingWidthRef.current !== null) {
          applySidebarWidth(pendingWidthRef.current);
          pendingWidthRef.current = null;
        }

        if (currentWidthRef.current !== null) {
          storage?.setLocal?.(SIDEBAR_WIDTH_KEY, currentWidthRef.current).catch(() => {
            /* ignore */
          });
        }
      };

      isResizingRef.current = true;
      resizeCleanupRef.current = stopResize;

      handle.setPointerCapture?.(pointerId);
      document.documentElement.classList.add('lockin-sidebar-resizing');
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopResize);
      window.addEventListener('pointercancel', stopResize);

      updateWidth(event.clientX);
    },
    [applySidebarWidth, storage],
  );

  const syncTextareaHeight = useCallback((target?: HTMLTextAreaElement | null) => {
    if (typeof window === 'undefined') return;
    const input = target ?? inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const maxHeightValue = window.getComputedStyle(input).maxHeight;
    const maxHeight = maxHeightValue === 'none' ? 0 : Number.parseFloat(maxHeightValue);
    const nextHeight = input.scrollHeight;
    if (!maxHeight || Number.isNaN(maxHeight)) {
      input.style.height = `${nextHeight}px`;
      input.style.overflowY = 'hidden';
      return;
    }
    input.style.height = `${Math.min(nextHeight, maxHeight)}px`;
    input.style.overflowY = nextHeight > maxHeight ? 'auto' : 'hidden';
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
                const normalized: ChatMessageItem[] = response.map((message: any) => ({
                  id: message.id || `msg-${Math.random().toString(16).slice(2)}`,
                  role: message.role === 'assistant' ? 'assistant' : 'user',
                  content:
                    message.content || message.output_text || message.input_text || 'Message',
                  timestamp: message.created_at || new Date().toISOString(),
                  mode: (message.mode as StudyMode) || mode,
                }));
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
    if (!storage?.getLocal) return;
    let cancelled = false;
    storage
      .getLocal(SIDEBAR_WIDTH_KEY)
      .then((storedWidth) => {
        if (cancelled) return;
        const numeric =
          typeof storedWidth === 'number'
            ? storedWidth
            : typeof storedWidth === 'string'
              ? Number.parseFloat(storedWidth)
              : null;
        if (typeof numeric === 'number' && !Number.isNaN(numeric) && numeric > 0) {
          applySidebarWidth(numeric);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [applySidebarWidth, storage]);

  useEffect(() => {
    if (!storage?.setLocal) return;
    storage.setLocal(SIDEBAR_OPEN_KEY, isOpen).catch(() => {
      /* ignore */
    });
  }, [isOpen, storage]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      if (currentWidthRef.current === null) return;
      applySidebarWidth(currentWidthRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applySidebarWidth]);

  useEffect(() => {
    if (!isOpen || activeTab !== CHAT_TAB_ID) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [activeTab, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || activeTab !== CHAT_TAB_ID) return;
    syncTextareaHeight();
  }, [activeTab, inputValue, isOpen, syncTextareaHeight]);

  useEffect(() => {
    return () => {
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (!activeTabExternal) return;
    setActiveTab((current) => (current === activeTabExternal ? current : activeTabExternal));
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
      if (event.key === 'Escape' && isOpen) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
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

  // Auto-switch to tool tab when a tool is opened
  useEffect(() => {
    if (activeToolId) {
      setActiveTab(TOOL_TAB_ID);
    }
  }, [activeToolId]);

  const upsertHistory = useCallback(
    (
      item: ChatHistoryItem,
      previousId?: string | null,
      titleSource: HistoryTitleSource = 'local',
    ) => {
      setRecentChats((prev) => {
        const existing = prev.find(
          (history) => history.id === item.id || (previousId && history.id === previousId),
        );
        const existingTitle = existing?.title || '';
        const incomingTitle = coerceChatTitle(item.title, existingTitle || FALLBACK_CHAT_TITLE);
        const normalizedExisting = clampChatTitle(existingTitle);
        const hasMeaningfulTitle =
          Boolean(normalizedExisting) && normalizedExisting !== FALLBACK_CHAT_TITLE;
        const shouldOverrideTitle = titleSource === 'server' || !hasMeaningfulTitle;

        const merged = {
          ...existing,
          ...item,
          title: shouldOverrideTitle ? incomingTitle : existingTitle || FALLBACK_CHAT_TITLE,
        };

        const filtered = prev.filter(
          (history) => history.id !== item.id && (!previousId || history.id !== previousId),
        );
        return [merged, ...filtered].slice(0, 12);
      });
    },
    [],
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
      const trimmedSelection = selection || selectedText || '';
      if (!trimmedSelection && !newUserMessage) return;

      setChatError(null);
      setIsSending(true);
      const pendingId = `assistant-${Date.now()}`;
      const pendingMessage: ChatMessageItem = {
        id: pendingId,
        role: 'assistant',
        content: 'Thinking...',
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
          response?.data?.explanation || `(${mode}) ${newUserMessage || trimmedSelection}`;
        const resolvedChatId = response?.chatId || chatId || provisionalChatId || null;
        const now = new Date().toISOString();
        const fallbackTitle = buildInitialChatTitle(newUserMessage || trimmedSelection);
        const serverTitle = response?.chatTitle;
        const resolvedTitle = serverTitle
          ? coerceChatTitle(serverTitle, fallbackTitle)
          : fallbackTitle;
        const titleSource: HistoryTitleSource = serverTitle ? 'server' : 'local';

        setMessages((prev) =>
          prev.map((message) =>
            message.id === pendingId
              ? { ...message, content: explanation, isPending: false }
              : message,
          ),
        );
        if (resolvedChatId) {
          setChatId(resolvedChatId);
          setActiveHistoryId(resolvedChatId);
          upsertHistory(
            {
              id: resolvedChatId,
              title: resolvedTitle,
              updatedAt: now,
              lastMessage: explanation,
            },
            provisionalChatId,
            titleSource,
          );
        }
      } catch (error: any) {
        const fallback =
          error?.message || 'We could not process this request. Try again in a moment.';
        setMessages((prev) =>
          prev.map((message) =>
            message.id === pendingId
              ? { ...message, content: fallback, isPending: false }
              : message,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [apiClient, chatId, courseCode, messages, mode, pageUrl, selectedText, upsertHistory],
  );

  const startNewChat = useCallback(
    (text: string, source: 'selection' | 'followup' = 'selection') => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const provisionalChatId = `chat-${Date.now()}`;
      const userMessage: ChatMessageItem = {
        id: `${provisionalChatId}-user`,
        role: 'user',
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
      upsertHistory(
        {
          id: provisionalChatId,
          title: buildInitialChatTitle(trimmed),
          updatedAt: now,
          lastMessage: trimmed,
        },
        undefined,
        'local',
      );

      triggerProcess({
        selection: trimmed,
        chatHistory: [userMessage],
        provisionalChatId,
      });
    },
    [mode, triggerProcess, upsertHistory],
  );

  const appendSelectionToCurrentChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const userMessage: ChatMessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: now,
        mode,
        source: 'selection',
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

      upsertHistory(
        {
          id: provisionalChatId,
          title: buildInitialChatTitle(trimmed),
          updatedAt: now,
          lastMessage: trimmed,
        },
        undefined,
        'local',
      );

      triggerProcess({
        selection: trimmed,
        newUserMessage: trimmed,
        chatHistory: nextMessages,
        provisionalChatId,
      });
    },
    [activeHistoryId, chatId, messages, mode, triggerProcess, upsertHistory],
  );

  useEffect(() => {
    if (!selectedText || selectedText.trim().length === 0) return;
    if (previousSelectionRef.current === selectedText) return;
    previousSelectionRef.current = selectedText;
    if (messages.length === 0) {
      startNewChat(selectedText, 'selection');
    } else {
      appendSelectionToCurrentChat(selectedText);
    }
  }, [appendSelectionToCurrentChat, messages.length, selectedText, startNewChat]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!apiClient?.getRecentChats) return;
      try {
        const result = await apiClient.getRecentChats({ limit: 8 });
        if (Array.isArray(result)) {
          const mapped = result.map((item: any) => ({
            id: item.id || `chat-${Math.random().toString(16).slice(2)}`,
            title: coerceChatTitle(item.title, FALLBACK_CHAT_TITLE),
            updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
            lastMessage: item.lastMessage || '',
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
          const normalized: ChatMessageItem[] = response.map((message: any) => ({
            id: message.id || `msg-${Math.random().toString(16).slice(2)}`,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content || message.output_text || message.input_text || 'Message',
            timestamp: message.created_at || new Date().toISOString(),
            mode: (message.mode as StudyMode) || mode,
          }));
          setMessages(normalized);
        }
      } catch (error: any) {
        setChatError(
          error?.message || 'Could not load this conversation. Try refreshing the page.',
        );
      } finally {
        setIsSending(false);
      }
    },
    [apiClient, mode],
  );

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isSending) return;
    appendSelectionToCurrentChat(inputValue);
    setInputValue('');
  }, [appendSelectionToCurrentChat, inputValue, isSending]);

  const startBlankChat = () => {
    const now = new Date().toISOString();
    const provisionalChatId = `chat-${Date.now()}`;
    setActiveTab(CHAT_TAB_ID);
    setIsHistoryOpen(false);
    setChatError(null);
    setMessages([]);
    setInputValue('');
    setChatId(null);
    setActiveHistoryId(provisionalChatId);
    upsertHistory(
      {
        id: provisionalChatId,
        title: FALLBACK_CHAT_TITLE,
        updatedAt: now,
        lastMessage: '',
      },
      undefined,
      'local',
    );
  };

  const handleSaveAsNote = useCallback(
    async (messageContent: string) => {
      if (!notesService) {
        setActiveTab(NOTES_TAB_ID);
        return;
      }

      try {
        const title = messageContent.split('\n')[0].trim().slice(0, 50) || 'Untitled note';

        const createdNote = await notesService.createNote({
          title,
          content: createNoteContentFromPlainText(messageContent.trim()),
          sourceUrl: pageUrl,
          courseCode: courseCode || null,
          noteType: 'manual',
        });

        upsertNote(createdNote);
        setSelectedNoteId(createdNote.id);
        setActiveTab(NOTES_TAB_ID);
      } catch (error: any) {
        console.error('Failed to save note:', error);
        setActiveTab(NOTES_TAB_ID);
      }
    },
    [courseCode, notesService, pageUrl, upsertNote],
  );

  const renderChatMessages = () => {
    if (!messages.length) {
      return (
        <div className="lockin-chat-empty">Ask anything about this page to start a new chat.</div>
      );
    }

    return messages.map((message) => {
      const roleClass =
        message.role === 'assistant'
          ? 'lockin-chat-msg lockin-chat-msg-assistant'
          : 'lockin-chat-msg lockin-chat-msg-user';
      const bubbleClass =
        message.role === 'assistant' ? 'lockin-chat-bubble' : 'lockin-chat-bubble';

      return (
        <div key={message.id} className={roleClass}>
          <div className={`${bubbleClass}${message.isPending ? ' lockin-chat-msg-pending' : ''}`}>
            {message.content}
          </div>
          {message.role === 'assistant' && !message.isPending ? (
            <SaveNoteAction onSaveAsNote={() => handleSaveAsNote(message.content)} />
          ) : null}
        </div>
      );
    });
  };

  return (
    <>
      {!isOpen && (
        <button id="lockin-toggle-pill" onClick={onToggle} aria-label="Open Lock-in sidebar">
          Lock-in
        </button>
      )}

      {isOpen && (
        <div
          id="lockin-sidebar"
          className="lockin-sidebar"
          data-state={isOpen ? 'expanded' : 'collapsed'}
        >
          <div
            className="lockin-sidebar-resize-handle"
            onPointerDown={handleResizeStart}
            aria-hidden="true"
          />
          <div className="lockin-top-bar">
            <div className="lockin-top-bar-left">
              <div className="lockin-tabs-wrapper" role="tablist">
                {[CHAT_TAB_ID, NOTES_TAB_ID].map((tabId) => {
                  const label = tabId === CHAT_TAB_ID ? 'Chat' : 'Notes';
                  const isActive = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      className={`lockin-tab ${isActive ? 'lockin-tab-active' : ''}`}
                      onClick={() => handleTabChange(tabId)}
                      role="tab"
                      aria-selected={isActive}
                    >
                      {label}
                    </button>
                  );
                })}
                {/* Active Tool tab - only shows when a tool is open */}
                {activeToolId && (
                  <button
                    className={`lockin-tab lockin-tab-closable ${activeTab === TOOL_TAB_ID ? 'lockin-tab-active' : ''}`}
                    onClick={() => handleTabChange(TOOL_TAB_ID)}
                    role="tab"
                    aria-selected={activeTab === TOOL_TAB_ID}
                  >
                    <span>{activeToolTitle}</span>
                    <span
                      className="lockin-tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTool();
                        if (activeTab === TOOL_TAB_ID) {
                          handleTabChange(CHAT_TAB_ID);
                        }
                      }}
                      role="button"
                      aria-label={`Close ${activeToolTitle}`}
                    >
                      ×
                    </span>
                  </button>
                )}
              </div>
            </div>
            <div className="lockin-top-bar-right">
              <StudyToolsDropdown />
            </div>
            <button className="lockin-close-btn" onClick={onToggle} aria-label="Close sidebar">
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
                    <span className="lockin-history-toggle-icon" aria-hidden="true">
                      <span className="lockin-history-toggle-line" />
                      <span className="lockin-history-toggle-line" />
                      <span className="lockin-history-toggle-line" />
                    </span>
                    <span className="lockin-sr-only">Toggle chat history</span>
                  </button>
                </div>
                <div className="lockin-chat-toolbar-right">
                  <ModeSelector value={mode} onSelect={(newMode) => setMode(newMode)} />
                  <button className="lockin-new-chat-btn" onClick={startBlankChat}>
                    + New chat
                  </button>
                </div>
              </div>

              <div
                className="lockin-chat-container"
                data-history-state={isHistoryOpen ? 'open' : 'closed'}
              >
                <aside
                  className="lockin-chat-history-panel"
                  data-state={isHistoryOpen ? 'open' : 'closed'}
                >
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
                            activeHistoryId === item.id ? 'active' : ''
                          }`}
                          onClick={() => handleHistorySelect(item)}
                        >
                          <div className="lockin-history-item-content">
                            <div className="lockin-history-title">{item.title}</div>
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
                        {chatError && <div className="lockin-chat-error">{chatError}</div>}
                      </div>
                    </div>

                    <div className="lockin-chat-bottom-section">
                      <div className="lockin-chat-input">
                        <textarea
                          className="lockin-chat-input-field"
                          placeholder="Ask a follow-up question..."
                          value={inputValue}
                          ref={inputRef}
                          onChange={(e) => {
                            setInputValue(e.target.value);
                            syncTextareaHeight(e.currentTarget);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
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
              onDeleteNote={async (noteId) => {
                await deleteNoteFromList(noteId);
                // Clear selection if the deleted note was selected
                if (selectedNoteId === noteId) {
                  setSelectedNoteId(null);
                }
              }}
              onToggleStar={toggleNoteStar}
              activeNoteId={selectedNoteId}
              onSelectNote={(noteId) => setSelectedNoteId(noteId)}
              courseCode={courseCode}
              pageUrl={pageUrl}
              currentWeek={pageContext?.courseContext?.week}
              onNoteEditingChange={setIsNoteEditing}
            />
          )}

          {/* Tool panel - renders active tool content */}
          {activeTab === TOOL_TAB_ID && activeToolId && (() => {
            const tool = getToolById(activeToolId);
            if (!tool) return null;
            const ToolComponent = tool.component;
            return (
              <div className="lockin-tool-panel">
                <ToolComponent onClose={closeTool} onSaveAsNote={handleSaveAsNote} />
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}

/**
 * LockInSidebar - Main sidebar component with Study Tools support.
 * Wraps content with ToolProvider for tool state management.
 */
export function LockInSidebar(props: LockInSidebarProps) {
  return (
    <ToolProvider>
      <LockInSidebarContent {...props} />
    </ToolProvider>
  );
}
