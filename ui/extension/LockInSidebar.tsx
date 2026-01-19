/**
 * LockInSidebar
 *
 * Main sidebar component for the Lock-in extension.
 * Refactored to use modular hooks for chat functionality.
 */

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
import { ToolProvider, useToolContext, StudyToolsDropdown, getToolById } from './tools';
import { NoteSaveProvider, useNoteSaveContext } from './contexts/NoteSaveContext';
import {
  ChatQueryProvider,
  useChat,
  useChatInput,
  relativeTimeLabel,
  type ChatMessage,
} from './chat';
import { FeedbackModal } from './feedback';

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Constants
// =============================================================================

const CHAT_TAB_ID = 'chat';
const NOTES_TAB_ID = 'notes';
const TOOL_TAB_ID = 'tool';
const SIDEBAR_ACTIVE_TAB_KEY = 'lockin_sidebar_activeTab';
const MODE_STORAGE_KEY = 'lockinActiveMode';
const SELECTED_NOTE_ID_KEY = 'lockin_sidebar_selectedNoteId';
const SIDEBAR_WIDTH_KEY = 'lockin_sidebar_width';
const SIDEBAR_OPEN_KEY = 'lockin_sidebar_isOpen';
const SIDEBAR_MIN_WIDTH = 360;
const SIDEBAR_MAX_WIDTH = 1500;
const SIDEBAR_MAX_VW = 0.75;

// =============================================================================
// Helper Functions
// =============================================================================

function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// =============================================================================
// Sub-Components
// =============================================================================

interface SaveNoteActionProps {
  content: string;
}

function SaveNoteAction({ content }: SaveNoteActionProps) {
  const { saveNote } = useNoteSaveContext();

  const handleSave = async () => {
    await saveNote({
      content,
      noteType: 'manual',
    });
  };

  return (
    <div className="lockin-chat-save-note-action">
      <button
        className="lockin-chat-save-note-btn"
        onClick={(e) => {
          e.stopPropagation();
          handleSave();
        }}
        type="button"
      >
        Save note
      </button>
    </div>
  );
}


// =============================================================================
// Main Sidebar Content Component
// =============================================================================

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

  // Tab and mode state
  const [activeTab, setActiveTab] = useState<string>(activeTabExternal || CHAT_TAB_ID);
  const [mode, setMode] = useState<StudyMode>(currentMode);

  // Notes state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [isNoteIdLoaded, setIsNoteIdLoaded] = useState(false);
  const lastForceOpenRef = useRef<number>(0);

  // Feedback modal state
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Resize state
  const layoutTimeoutRef = useRef<number | null>(null);
  const isResizingRef = useRef(false);
  const resizeRafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const currentWidthRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Derived values
  const courseCode = pageContext?.courseContext.courseCode || null;
  const pageUrl = pageContext?.url || (typeof window !== 'undefined' ? window.location.href : '');

  // ==========================================================================
  // Chat Hook - Replaces ~400 lines of embedded chat logic
  // ==========================================================================
  const {
    messages,
    recentChats,
    activeHistoryId,
    isSending,
    error: chatError,
    sendMessage,
    startBlankChat,
    selectChat,
    isHistoryOpen,
    setIsHistoryOpen,
  } = useChat({
    apiClient,
    storage,
    mode,
    pageUrl,
    courseCode,
    selectedText,
  });

  // Chat input hook
  const {
    value: inputValue,
    inputRef,
    handleChange: handleInputChange,
    handleKeyDown: handleInputKeyDown,
    handleSend: handleInputSend,
    syncHeight: syncTextareaHeight,
  } = useChatInput({
    onSend: (value) => sendMessage(value, 'followup'),
    isSending,
    shouldFocus: isOpen && activeTab === CHAT_TAB_ID,
  });

  // ==========================================================================
  // Notes Service
  // ==========================================================================
  const notesService: NotesService | null = useMemo(
    () => (apiClient ? createNotesService(apiClient) : null),
    [apiClient],
  );

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

  // ==========================================================================
  // Sidebar Resize Logic
  // ==========================================================================
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

  // ==========================================================================
  // Tab Change Handler
  // ==========================================================================
  const handleTabChange = useCallback((tabId: string) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    setActiveTab(tabId);

    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }, []);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load active tab from storage
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
      storage.set(SELECTED_NOTE_ID_KEY, null).catch(() => {
        /* ignore */
      });
    }
  }, [selectedNoteId, storage, isNoteIdLoaded]);

  // Persist active tab when it changes
  useEffect(() => {
    if (!storage) return;
    storage.set(SIDEBAR_ACTIVE_TAB_KEY, activeTab).catch(() => {
      /* ignore */
    });
  }, [activeTab, storage]);

  // Persist mode when it changes
  useEffect(() => {
    if (!storage) return;
    storage.set(MODE_STORAGE_KEY, mode).catch(() => {
      /* ignore */
    });
  }, [mode, storage]);

  // Load sidebar width from storage
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

  // Persist sidebar open state
  useEffect(() => {
    if (!storage?.setLocal) return;
    storage.setLocal(SIDEBAR_OPEN_KEY, isOpen).catch(() => {
      /* ignore */
    });
  }, [isOpen, storage]);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      if (currentWidthRef.current === null) return;
      applySidebarWidth(currentWidthRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applySidebarWidth]);

  // Focus input when chat tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== CHAT_TAB_ID) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [activeTab, isOpen, inputRef]);

  // Sync textarea height
  useLayoutEffect(() => {
    if (!isOpen || activeTab !== CHAT_TAB_ID) return;
    syncTextareaHeight();
  }, [activeTab, inputValue, isOpen, syncTextareaHeight]);

  // Cleanup resize on unmount
  useEffect(() => {
    return () => {
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    };
  }, []);

  // Sync external tab prop
  useEffect(() => {
    if (!activeTabExternal) return;
    setActiveTab((current) => (current === activeTabExternal ? current : activeTabExternal));
  }, [activeTabExternal]);

  // Apply split layout
  useEffect(() => {
    applySplitLayout(isOpen);
    return () => {
      applySplitLayout(false);
      if (layoutTimeoutRef.current) {
        window.clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, [applySplitLayout, isOpen]);

  // Handle Escape key
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

  // Sync mode with prop
  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  // Force open sidebar when editing note
  useEffect(() => {
    if (isNoteEditing && !isOpen) {
      const now = Date.now();
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

  // Refresh notes when switching to notes tab
  useEffect(() => {
    if (activeTab === NOTES_TAB_ID) {
      refreshNotes();
    }
  }, [activeTab, refreshNotes]);

  // ==========================================================================
  // Render Chat Messages
  // ==========================================================================
  const renderChatMessages = () => {
    if (!messages.length) {
      return (
        <div className="lockin-chat-empty">Ask anything about this page to start a new chat.</div>
      );
    }

    return messages.map((message: ChatMessage) => {
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
            <SaveNoteAction content={message.content} />
          ) : null}
        </div>
      );
    });
  };

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <NoteSaveProvider
      notesService={notesService}
      pageUrl={pageUrl}
      courseCode={courseCode}
      upsertNote={upsertNote}
      setSelectedNoteId={setSelectedNoteId}
      setActiveTab={setActiveTab}
    >
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
              <button
                className="lockin-feedback-trigger-btn"
                onClick={() => setIsFeedbackOpen(true)}
                aria-label="Send feedback"
                title="Send feedback"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
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
                          onClick={() => selectChat(item)}
                        >
                          <div className="lockin-history-item-content">
                            <div className="lockin-history-title">{item.title}</div>
                            <div className="lockin-history-meta">
                              {relativeTimeLabel(item.updatedAt)}
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
                          <div className="lockin-chat-error">{chatError.message}</div>
                        )}
                      </div>
                    </div>

                    <div className="lockin-chat-bottom-section">
                      <div className="lockin-chat-input">
                        <textarea
                          className="lockin-chat-input-field"
                          placeholder="Ask a follow-up question..."
                          value={inputValue}
                          ref={inputRef}
                          onChange={handleInputChange}
                          onKeyDown={handleInputKeyDown}
                          rows={1}
                        />
                        <button
                          className="lockin-send-btn"
                          disabled={!inputValue.trim() || isSending}
                          onClick={handleInputSend}
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
          {activeTab === TOOL_TAB_ID &&
            activeToolId &&
            (() => {
              const tool = getToolById(activeToolId);
              if (!tool) return null;
              const ToolComponent = tool.component;
              return (
                <div className="lockin-tool-panel">
                  <ToolComponent onClose={closeTool} />
                </div>
              );
            })()}
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        apiClient={apiClient}
        pageUrl={pageUrl}
        courseCode={courseCode}
      />
    </NoteSaveProvider>
  );
}

// =============================================================================
// Main Export with Providers
// =============================================================================

/**
 * LockInSidebar - Main sidebar component with Study Tools support.
 * Wraps content with ToolProvider for tool state management.
 * Wraps with ChatQueryProvider for TanStack Query support.
 * NoteSaveProvider is inside LockInSidebarContent for access to internal state.
 */
export function LockInSidebar(props: LockInSidebarProps) {
  return (
    <ToolProvider>
      <ChatQueryProvider>
        <LockInSidebarContent {...props} />
      </ChatQueryProvider>
    </ToolProvider>
  );
}
