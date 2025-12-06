/**
 * Lock-in Content Script - Contextual AI Assistant
 * Features:
 * - Modifier key requirement (Ctrl/Cmd + selection)
 * - Smart contextual bubble placement
 * - Draggable response bubble
 * - On/off toggle via popup
 */

/**
 * @typedef {Object} StudyResponse
 * @property {string} mode - The mode used ("explain" | "simplify" | "translate" | "general")
 * @property {string} explanation - The main answer/explanation for the user
 * @property {Array<{title: string, content: string, type: string}>} notes - Array of possible notes to save
 * @property {Array<{title: string, description: string}>} todos - Array of possible tasks
 * @property {string[]} tags - Array of topic tags
 * @property {"easy" | "medium" | "hard"} difficulty - Estimated difficulty of the selected text
 */

/**
 * @typedef {Object} LockInApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {StudyResponse} [data] - Response data if success is true
 * @property {{message: string}} [error] - Error information if success is false
 * @property {string} [chatId] - Chat ID if available
 */

// ===================================
// Configuration
// ===================================
const BACKEND_URL =
  (window.LOCKIN_CONFIG && window.LOCKIN_CONFIG.BACKEND_URL) ||
  "http://localhost:3000";
const MIN_SELECTION_LENGTH = 3; // Minimum characters to trigger
const BUBBLE_OFFSET = 10; // Pixels offset from selection
const CHAT_ID_STORAGE_KEY = "lockinCurrentChatId";
const RECENT_CHAT_LIMIT = 10;

// ===================================
// Modes Configuration (easy to extend)
// ===================================
const MODES = {
  EXPLAIN: "explain",
  SIMPLIFY: "simplify",
  TRANSLATE: "translate",
};

const MODE_CONFIG = {
  [MODES.EXPLAIN]: { icon: "&#128161;", label: "Explain" },
  [MODES.SIMPLIFY]: { icon: "&#9986;", label: "Simplify" },
  [MODES.TRANSLATE]: { icon: "&#127757;", label: "Translate" },
};

// ===================================
// Theme & Personalisation Configuration
// ===================================
const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
};

const ACCENT_COLORS = {
  BLUE: { name: "Blue", hex: "#667eea" },
  PURPLE: { name: "Purple", hex: "#a78bfa" },
  TEAL: { name: "Teal", hex: "#14b8a6" },
  GREEN: { name: "Green", hex: "#10b981" },
  ORANGE: { name: "Orange", hex: "#f59e0b" },
};

// ===================================
// State Management
// ===================================
let highlightingEnabled = true; // Toggle state from popup
let currentMode = MODES.EXPLAIN; // Current active mode
let isBubbleOpen = true; // Bubble visibility state (persisted)
let cachedSelection = ""; // Selected text
let cachedRect = null; // Selection bounding box
let activeBubble = null; // Current bubble element (widget-based)
let activePill = null; // Legacy pill element (unused with LockinWidget, kept for safety)
let isDraggingBubble = false; // Legacy drag flag (no longer used with LockinWidget)
let chatHistory = []; // Conversation history for the current selection
let pendingInputValue = ""; // Value inside the follow-up input
let isChatLoading = false; // Whether we are waiting on the backend
let sessionPreferences = {
  preferredLanguage: "en",
  difficultyLevel: "highschool",
};
let currentTabId = null; // Current tab ID
let currentOrigin = window.location.origin; // Current origin
let currentChatId = null; // Active chat identifier shared across popup/content
let recentChats = [];
let isHistoryPanelOpen = false;
let historyStatusMessage = "";
let isHistoryLoading = false;
let hasLoadedChats = false;
let currentStudyResponse = null; // Store the current StudyResponse data (notes, todos, tags, etc.)
const isMac = navigator.platform.toUpperCase().includes("MAC");

// Theme & personalisation state
let currentTheme = THEMES.LIGHT;
let currentAccentColor = "#667eea";
let userProfile = {
  name: "User",
  email: "user@example.com",
  plan: "Free",
};
let isPersonalisationPanelOpen = false;

// Notes state
let notesViewMode = "current"; // "current" | "all"
let notesFilter = "page"; // "page" | "course" | "all" | "starred"
let notesSearchQuery = "";
let notesListCache = [];
let activeNote = createEmptyNote();
let noteSaveTimer = null;
let noteSaveStatus = "Saved · just now";
let isNoteSaving = false;
let notesLoading = false;
let hasLoadedNotes = false;
let noteHasChanges = false;

// ===================================
// Global Widget & Shared Utilities
// ===================================
let lockinWidget = null;

// Optional shared utilities loaded from chatHistoryUtils.js.
// The content script must continue to work even if this file fails to load.
const LockInChatHistoryUtils = window.LockInChatHistoryUtils || null;

// Shared modules (must be loaded before this script)
const Storage = window.LockInStorage || null;
const API = window.LockInAPI || null;
const Messaging = window.LockInMessaging || null;
const Logger = window.LockInLogger || {
  debug: () => {},
  info: () => {},
  warn: console.warn,
  error: console.error,
};

// STORAGE_KEYS is loaded globally by libs/storage.js
// which is loaded before this script in manifest.json
// Fallback to local definition if not available
if (typeof STORAGE_KEYS === "undefined") {
  window.STORAGE_KEYS = {
    BUBBLE_OPEN: "lockinBubbleOpen",
    ACTIVE_MODE: "lockinActiveMode",
    THEME: "lockinTheme",
    ACCENT_COLOR: "lockinAccentColor",
    BUBBLE_POSITION: "lockinBubblePosition",
    BUBBLE_SIZE: "lockinBubbleSize",
    USER_PROFILE: "lockinUserProfile",
  };
}

// ===================================
// Load persisted UI preferences
// ===================================
async function loadToggleState() {
  if (!Storage) {
    return;
  }

  try {
    const data = await Storage.get("highlightingEnabled");
    highlightingEnabled = data.highlightingEnabled !== false;
  } catch (error) {
    Logger.warn("Failed to load toggle state:", error);
  }
}

async function loadThemeAndPersonalisation() {
  if (!Storage) {
    return;
  }

  try {
    const data = await Storage.get([
      STORAGE_KEYS.THEME,
      STORAGE_KEYS.ACCENT_COLOR,
      STORAGE_KEYS.ACTIVE_MODE,
      STORAGE_KEYS.USER_PROFILE,
    ]);
    currentTheme = data[STORAGE_KEYS.THEME] || THEMES.LIGHT;
    currentAccentColor = data[STORAGE_KEYS.ACCENT_COLOR] || "#667eea";
    currentMode = data[STORAGE_KEYS.ACTIVE_MODE] || MODES.EXPLAIN;
    if (data[STORAGE_KEYS.USER_PROFILE]) {
      userProfile = data[STORAGE_KEYS.USER_PROFILE];
    }
    applyTheme();
  } catch (error) {
    Logger.warn("Failed to load theme and personalisation:", error);
  }
}

// ===================================
// Initialization
// ===================================
async function init() {
  await loadToggleState();
  await loadThemeAndPersonalisation();
  listenToStorageChanges();
  setupEventListeners();
  await loadStoredChatId();
  listenToAuthChanges();

  // Initialize sidebar system (replaces LockinWidget)
  if (typeof LockinSidebar !== "undefined") {
    Logger.debug("LockinSidebar class found, initializing...");
    initializeSidebar();
  } else {
    Logger.warn("LockinSidebar class not found!");
  }

  // Get tab ID and restore session if available
  getTabId().then(() => {
    setTimeout(loadSessionForCurrentTab, 500);
  });
}

/**
 * Initialize the Lock-in sidebar
 */
function initializeSidebar() {
  Logger.debug("initializeSidebar called");
  lockinWidget = new LockinSidebar({
    sidebarWidth: 380,
  });
  Logger.debug("LockinSidebar instance created");
  lockinWidget.init();
  Logger.debug("Sidebar init() called, sidebar.isOpen:", lockinWidget.isOpen);

  // Listen to sidebar events
  window.addEventListener("lockin:open", handleSidebarOpen);
  window.addEventListener("lockin:close", handleSidebarClose);
  window.addEventListener("lockin:selectChat", handleSelectChat);
  window.addEventListener("lockin:newChat", handleNewChatEvent);
  window.addEventListener("lockin:switchMode", handleSwitchModeEvent);
  window.addEventListener("lockin:sendMessage", handleSendMessageEvent);
  window.addEventListener("lockin:deleteChat", handleDeleteChatEvent);
  window.addEventListener("lockin:loadNotes", handleLoadNotesEvent);
  Logger.debug("Sidebar event listeners attached");
}

/**
 * Handle sidebar open event
 */
async function handleSidebarOpen() {
  isBubbleOpen = true;
  if (Storage) {
    try {
      await Storage.set(STORAGE_KEYS.BUBBLE_OPEN, true);
    } catch (error) {
      Logger.warn("Failed to save sidebar state:", error);
    }
  }
  renderSidebarContent();
}

/**
 * Handle sidebar close event
 */
async function handleSidebarClose() {
  isBubbleOpen = false;
  if (Storage) {
    try {
      await Storage.set(STORAGE_KEYS.BUBBLE_OPEN, false);
    } catch (error) {
      Logger.warn("Failed to save sidebar state:", error);
    }
  }
}

/**
 * Handle select chat event
 */
function handleSelectChat(event) {
  const { chatId } = event.detail;
  handleHistorySelection(chatId);
}

/**
 * Handle new chat event
 */
function handleNewChatEvent() {
  handleNewChatRequest();
}

/**
 * Handle switch mode event
 */
async function handleSwitchModeEvent(event) {
  const { mode } = event.detail;
  if (mode && MODES[Object.keys(MODES).find((k) => MODES[k] === mode)]) {
    // Only trigger API call if we have a cached selection (active chat context)
    if (cachedSelection) {
      currentMode = mode;
      if (Storage) {
        try {
          await Storage.set(STORAGE_KEYS.ACTIVE_MODE, mode);
        } catch (error) {
          Logger.warn("Failed to save active mode:", error);
        }
      }
      // Reset chat history to get fresh response for the new mode
      chatHistory = [];
      // Make a new API call with the new mode
      runMode(mode);
    }
  }
}

/**
 * Handle send message event
 */
function handleSendMessageEvent() {
  handleFollowUpSubmit();
}

/**
 * Handle delete chat event
 */
function handleDeleteChatEvent(event) {
  const { chatId } = event.detail;
  handleDeleteChat(chatId);
}

function handleLoadNotesEvent(event) {
  const filter = event.detail?.filter || notesFilter || "page";
  notesFilter = filter;
  notesViewMode = "current";
  setNotesView("current", lockinWidget?.getSidebarElement());
  loadNotes(filter);
}

/**
 * Render sidebar content
 */
function renderSidebarContent() {
  if (!lockinWidget) {
    return;
  }

  const sidebarElement = lockinWidget.getSidebarElement();
  if (!sidebarElement) {
    return;
  }

  // Build each section separately
  const modesHtml = buildModeSelector();
  const chatHtml = buildChatSection();
  const notesHtml = buildNotesSection();
  const historyHtml = buildHistorySection();

  // Render using sidebar's renderContent method
  lockinWidget.renderContent({
    modes: modesHtml,
    chat: chatHtml,
    notes: notesHtml,
    history: historyHtml,
  });

  // Attach textarea and input listeners after rendering
  attachSidebarInputListeners(sidebarElement);
  attachChatActionListeners(sidebarElement);
  attachNotesUiListeners(sidebarElement);

  scrollChatToBottom();
}

/**
 * Attach event listeners to sidebar input elements
 */
function attachSidebarInputListeners(sidebarElement) {
  const input = sidebarElement.querySelector("#lockin-chat-input");
  const sendBtn = sidebarElement.querySelector(".lockin-send-btn");
  const chatForm = sidebarElement.querySelector(".lockin-chat-input");

  if (input) {
    input.value = pendingInputValue;
    input.addEventListener("input", (e) => {
      pendingInputValue = e.target.value;
      if (sendBtn) {
        sendBtn.disabled =
          isChatLoading || pendingInputValue.trim().length === 0;
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !isChatLoading) {
        e.preventDefault();
        if (sendBtn) sendBtn.click();
      }
    });
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (sendBtn && !sendBtn.disabled) {
        handleFollowUpSubmit();
      }
    });
  }
}

/**
 * Attach event listeners to chat action buttons (Save as note, Generate notes)
 */
function attachChatActionListeners(sidebarElement) {
  const actionButtons = sidebarElement.querySelectorAll(
    ".lockin-chat-action-btn"
  );

  actionButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.getAttribute("data-action");
      const messageId = btn.getAttribute("data-message-id");

      // Get the message content from the bubble
      const bubble = btn
        .closest(".lockin-chat-msg")
        ?.querySelector(".lockin-chat-bubble");
      const messageContent = bubble?.textContent?.trim() || "";

      if (action === "save-note") {
        onSaveAsNote(messageId, messageContent);
      } else if (action === "generate-notes") {
        onGenerateNotes(messageId, messageContent);
      }
    });
  });

  // Attach draft panel actions
  const draftPanel = sidebarElement.querySelector(".lockin-ai-draft-panel");
  if (draftPanel) {
    const insertBtn = draftPanel.querySelector('[data-action="insert-draft"]');
    const saveBtn = draftPanel.querySelector(
      '[data-action="save-draft-separate"]'
    );
    const dismissBtn = draftPanel.querySelector(
      '[data-action="dismiss-draft"]'
    );
    const closeBtn = draftPanel.querySelector(".lockin-draft-panel-close");

    if (insertBtn) {
      insertBtn.addEventListener("click", () => {
        insertDraftIntoCurrent();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        saveDraftNotesAsSeparate();
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        clearAiDraftPanel();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        clearAiDraftPanel();
      });
    }
  }
}
// Removed attachNoteButtonListeners - no longer needed after UX redesign
// Old suggested notes UI has been replaced with on-demand AI draft panel

/**
 * Attach event listeners for the Notes experience (header, editor, list)
 */
function attachNotesUiListeners(sidebarElement) {
  if (!sidebarElement) return;

  const titleInput = sidebarElement.querySelector("#lockin-note-title");
  const editorEl = sidebarElement.querySelector("#lockin-note-editor");
  const viewButtons = sidebarElement.querySelectorAll(
    ".lockin-notes-toggle-btn"
  );
  const newNoteBtn = sidebarElement.querySelector(".lockin-new-note-btn");
  const searchInput = sidebarElement.querySelector("#lockin-notes-search");
  const filterSelect = sidebarElement.querySelector(
    "#lockin-notes-filter-select"
  );
  const toolbarButtons = sidebarElement.querySelectorAll(
    "[data-note-command]"
  );
  const menuTrigger = sidebarElement.querySelector(".lockin-note-menu-trigger");
  const overflowMenu = sidebarElement.querySelector(".lockin-note-menu");
  const duplicateBtn = sidebarElement.querySelector(
    '[data-action="duplicate-note"]'
  );
  const deleteBtn = sidebarElement.querySelector('[data-action="delete-note"]');

  populateCurrentNoteFields(sidebarElement);
  renderNotesList();

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const view = btn.getAttribute("data-view");
      setNotesView(view, sidebarElement);
    });
  });

  if (newNoteBtn) {
    newNoteBtn.addEventListener("click", () => {
      startNewNote();
      setNotesView("current", sidebarElement);
      populateCurrentNoteFields(sidebarElement);
      titleInput?.focus();
    });
  }

  if (titleInput) {
    titleInput.value = activeNote.title || "";
    titleInput.addEventListener("input", (e) => {
      activeNote.title = e.target.value;
      noteHasChanges = true;
      scheduleNoteSave();
    });
  }

  if (editorEl) {
    editorEl.innerHTML = sanitizeNoteContent(activeNote.content || "");
    editorEl.addEventListener("input", () => {
      activeNote.content = editorEl.innerHTML;
      noteHasChanges = true;
      scheduleNoteSave();
    });
  }

  toolbarButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const command = btn.getAttribute("data-note-command");
      const value = btn.getAttribute("data-note-value");

      if (!editorEl) return;
      editorEl.focus();

      if (command === "checkbox") {
        document.execCommand("insertText", false, "- [ ] ");
      } else if (command === "code") {
        const selection = window.getSelection()?.toString() || "";
        const codeText = selection || "code";
        document.execCommand(
          "insertHTML",
          false,
          `<code>${escapeHtml(codeText)}</code>`
        );
      } else {
        document.execCommand(command, false, value || null);
      }

      activeNote.content = editorEl.innerHTML;
      noteHasChanges = true;
      scheduleNoteSave();
    });
  });

  if (menuTrigger && overflowMenu) {
    const closeMenu = (event) => {
      if (
        overflowMenu.contains(event.target) ||
        menuTrigger.contains(event.target)
      ) {
        return;
      }
      overflowMenu.classList.remove("is-open");
      menuTrigger.setAttribute("aria-expanded", "false");
    };

    menuTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = overflowMenu.classList.toggle("is-open");
      menuTrigger.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
        document.addEventListener("click", closeMenu, { once: true });
      }
    });
  }

  if (duplicateBtn) {
    duplicateBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await duplicateActiveNote();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteActiveNote();
    });
  }

  if (searchInput) {
    searchInput.value = notesSearchQuery;
    searchInput.addEventListener("input", (e) => {
      notesSearchQuery = e.target.value || "";
      renderNotesList();
    });
  }

  if (filterSelect) {
    filterSelect.value = notesFilter;
    filterSelect.addEventListener("change", async (e) => {
      const filter = e.target.value;
      notesFilter = filter;
      await loadNotes(filter);
    });
  }
}

function setNotesView(view, sidebarElement) {
  if (!view) return;
  notesViewMode = view;

  const viewButtons = sidebarElement?.querySelectorAll(
    ".lockin-notes-toggle-btn"
  );
  viewButtons?.forEach((btn) => {
    const isActive = btn.getAttribute("data-view") === view;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  const currentView = sidebarElement?.querySelector(".lockin-note-current-view");
  const listView = sidebarElement?.querySelector(".lockin-all-notes-view");

  if (currentView) {
    currentView.classList.toggle("is-active", view === "current");
  }
  if (listView) {
    listView.classList.toggle("is-active", view === "all");
  }

  if (view === "all" && !hasLoadedNotes) {
    loadNotes(notesFilter);
  }
}

function populateCurrentNoteFields(sidebarElement) {
  const titleInput = sidebarElement?.querySelector("#lockin-note-title");
  const editorEl = sidebarElement?.querySelector("#lockin-note-editor");
  const statusEl = sidebarElement?.querySelector("#lockin-note-status");

  if (titleInput) {
    titleInput.value = activeNote.title || "";
  }

  if (editorEl) {
    editorEl.innerHTML = sanitizeNoteContent(activeNote.content || "");
  }

  if (statusEl) {
    statusEl.textContent = noteSaveStatus;
  }

  updateNoteMetaRow(sidebarElement);
}

function updateNoteMetaRow(sidebarElement) {
  const linkTarget = sidebarElement?.querySelector("#lockin-note-linked-target");
  const stamps = sidebarElement?.querySelector("#lockin-note-stamps");
  const courseLabelEl = sidebarElement?.querySelector(
    "#lockin-notes-course-label"
  );

  if (courseLabelEl) {
    courseLabelEl.textContent = getNotesCourseLabel();
  }

  const linkedContext = buildLinkedContextLabel(activeNote);
  if (linkTarget) {
    if (linkedContext.label) {
      const safeLabel = truncateText(linkedContext.label, 60);
      linkTarget.innerHTML = linkedContext.url
        ? `<a href="${escapeHtml(
            linkedContext.url
          )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            safeLabel
          )}</a>`
        : `<span>${escapeHtml(safeLabel)}</span>`;
    } else {
      linkTarget.innerHTML =
        '<span class="lockin-note-link-empty">Linked to: None</span>';
    }
  }

  if (stamps) {
    const metaText = buildNoteMetaText(activeNote);
    stamps.textContent = metaText;
  }
}

function setNoteStatus(statusText) {
  noteSaveStatus = statusText;
  const sidebarElement = lockinWidget?.getSidebarElement();
  const statusEl = sidebarElement?.querySelector("#lockin-note-status");
  if (statusEl) {
    statusEl.textContent = statusText;
  }
}

function scheduleNoteSave() {
  setNoteStatus("Saving...");
  if (noteSaveTimer) {
    clearTimeout(noteSaveTimer);
  }
  noteSaveTimer = setTimeout(() => {
    saveActiveNote();
  }, 800);
}

async function saveActiveNote(forceCreate = false) {
  if (!activeNote) return;

  const title = (activeNote.title || "").trim();
  const content = (activeNote.content || "").trim();

  if (!content && !title) {
    setNoteStatus("Empty note not saved");
    return;
  }

  if (!noteHasChanges && activeNote.id) {
    return;
  }

  if (!window.LockInAPI || !window.LockInAPI.createNote) {
    setNoteStatus("Offline – changes pending");
    return;
  }

  const payload = {
    title: title || "Untitled Note",
    content: sanitizeNoteContent(activeNote.content || ""),
    sourceSelection: activeNote.sourceSelection || "",
    sourceUrl: activeNote.sourceUrl || window.location.href,
    courseCode: activeNote.courseCode || null,
    noteType: activeNote.noteType || "manual",
    tags: activeNote.tags || [],
  };

  try {
    isNoteSaving = true;
    const shouldUpdate =
      activeNote.id && window.LockInAPI.updateNote && !forceCreate;
    const savedNote = shouldUpdate
      ? await window.LockInAPI.updateNote(activeNote.id, payload)
      : await window.LockInAPI.createNote(payload);

    const normalized = normalizeNote(savedNote || payload);
    if (!normalized.id && activeNote.id) {
      normalized.id = activeNote.id;
    }

    activeNote = { ...activeNote, ...normalized };
    upsertNoteInCache(normalized);
    noteHasChanges = false;
    isNoteSaving = false;
    setNoteStatus("Saved · just now");
    updateNoteMetaRow(lockinWidget?.getSidebarElement());
  } catch (error) {
    Logger.error("Failed to save note:", error);
    isNoteSaving = false;
    setNoteStatus("Offline – changes pending");
    showToast("Failed to save note. We’ll retry soon.", "error");
  }
}

function upsertNoteInCache(note) {
  if (!note) return;
  const idx = notesListCache.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    notesListCache[idx] = { ...notesListCache[idx], ...note };
  } else {
    notesListCache.unshift(note);
  }
  renderNotesList();
}

async function duplicateActiveNote() {
  if (!activeNote || !activeNote.content) {
    showToast("Nothing to duplicate yet.", "info");
    return;
  }

  if (!window.LockInAPI || !window.LockInAPI.createNote) {
    showToast("Notes API unavailable right now.", "error");
    return;
  }

  const duplicatePayload = {
    title: `${activeNote.title || "Untitled"} (copy)`,
    content: sanitizeNoteContent(activeNote.content || ""),
    sourceSelection: activeNote.sourceSelection || "",
    sourceUrl: activeNote.sourceUrl || window.location.href,
    courseCode: activeNote.courseCode || null,
    noteType: activeNote.noteType || "manual",
    tags: activeNote.tags || [],
  };

  try {
    const saved = await window.LockInAPI.createNote(duplicatePayload);
    const normalized = normalizeNote(saved || duplicatePayload);
    activeNote = normalized;
    upsertNoteInCache(normalized);
    setNotesView("current", lockinWidget?.getSidebarElement());
    populateCurrentNoteFields(lockinWidget?.getSidebarElement());
    showToast("Note duplicated");
  } catch (error) {
    Logger.error("Failed to duplicate note:", error);
    showToast("Couldn't duplicate this note.", "error");
  }
}

async function deleteActiveNote() {
  if (!activeNote || !activeNote.id) {
    startNewNote();
    populateCurrentNoteFields(lockinWidget?.getSidebarElement());
    return;
  }

  if (!window.LockInAPI || !window.LockInAPI.deleteNote) {
    showToast("Delete note is not available right now.", "error");
    return;
  }

  try {
    await window.LockInAPI.deleteNote(activeNote.id);
    notesListCache = notesListCache.filter((n) => n.id !== activeNote.id);
    startNewNote();
    populateCurrentNoteFields(lockinWidget?.getSidebarElement());
    renderNotesList();
    showToast("Note deleted");
  } catch (error) {
    Logger.error("Failed to delete note:", error);
    showToast("Couldn't delete that note.", "error");
  }
}

function startNewNote(prefill = {}) {
  activeNote = createEmptyNote(prefill);
  noteHasChanges = false;
  setNoteStatus("Saved · just now");
}

/**
 * Attach resize handler for chat messages container (removed - no longer needed)
 */
function attachChatResizeHandler(sidebarElement) {
  // Resize handle removed in new design - using flex layout instead
}

/**
 * Build the chat section HTML
 */
function buildChatSection() {
  const chatHtml = buildChatMessagesHtml(chatHistory);
  const sendDisabled = isChatLoading || pendingInputValue.trim().length === 0;

  return `
    <div class="lockin-chat-messages-wrapper">
      <div class="lockin-chat-messages" id="lockin-chat-messages">${chatHtml}</div>
    </div>
    <div class="lockin-chat-bottom-section">
      <form class="lockin-chat-input">
        <input class="lockin-chat-input-field" id="lockin-chat-input" name="lockin-chat-input" placeholder="Ask a follow-up question..." ${
          isChatLoading ? "disabled" : ""
        } />
        <button class="lockin-send-btn" type="submit" ${
          sendDisabled ? "disabled" : ""
        }>Send</button>
      </form>
    </div>
  `;
}

/**
 * Build the notes section HTML - New layout with doc-like editor
 */
function buildNotesSection() {
  const isCurrent = notesViewMode === "current";
  const isAll = notesViewMode === "all";

  return `
    <div class="lockin-notes-shell">
      <div class="lockin-notes-header">
        <div class="lockin-notes-heading">
          <div class="lockin-notes-heading-title">Notes</div>
          <div class="lockin-notes-heading-subtitle" id="lockin-notes-course-label">${escapeHtml(
            getNotesCourseLabel()
          )}</div>
        </div>
        <div class="lockin-notes-toggle" role="group" aria-label="Notes view">
          <button class="lockin-notes-toggle-btn ${
            isCurrent ? "is-active" : ""
          }" data-view="current" type="button" aria-pressed="${
    isCurrent ? "true" : "false"
  }">Current</button>
          <button class="lockin-notes-toggle-btn ${
            isAll ? "is-active" : ""
          }" data-view="all" type="button" aria-pressed="${
    isAll ? "true" : "false"
  }">All notes</button>
        </div>
        <div class="lockin-notes-actions">
          <button class="lockin-btn-primary lockin-new-note-btn" type="button" title="Create a new note">+ New note</button>
        </div>
      </div>

      <div class="lockin-notes-body">
        ${buildCurrentNoteView(isCurrent)}
        ${buildAllNotesView(isAll)}
      </div>
    </div>
  `;
}

function buildCurrentNoteView(isActive) {
  return `
    <div class="lockin-note-current-view ${isActive ? "is-active" : ""}">
      <div class="lockin-note-meta-row">
        <div class="lockin-note-link">
          <span class="lockin-note-link-label">Linked to:</span>
          <span id="lockin-note-linked-target" class="lockin-note-link-target"></span>
        </div>
        <div class="lockin-note-stamps" id="lockin-note-stamps">${escapeHtml(
          buildNoteMetaText(activeNote)
        )}</div>
      </div>

      <div class="lockin-note-title-wrap">
        <input id="lockin-note-title" class="lockin-note-title-input" placeholder="Note title..." />
      </div>

      <div class="lockin-note-toolbar">
        <div class="lockin-note-toolbar-left">
          <button class="lockin-note-tool-btn" type="button" data-note-command="bold" title="Bold (Ctrl/Cmd+B)">B</button>
          <button class="lockin-note-tool-btn" type="button" data-note-command="italic" title="Italic (Ctrl/Cmd+I)">I</button>
          <button class="lockin-note-tool-btn" type="button" data-note-command="underline" title="Underline (Ctrl/Cmd+U)">U</button>
          <span class="lockin-note-toolbar-divider"></span>
          <button class="lockin-note-tool-btn" type="button" data-note-command="insertUnorderedList" title="Bulleted list">•</button>
          <button class="lockin-note-tool-btn" type="button" data-note-command="insertOrderedList" title="Numbered list">1.</button>
          <button class="lockin-note-tool-btn" type="button" data-note-command="checkbox" title="Checkbox list">☐</button>
          <button class="lockin-note-tool-btn" type="button" data-note-command="code" title="Inline code">&lt;/&gt;</button>
        </div>
        <div class="lockin-note-toolbar-right">
          <button class="lockin-note-menu-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="More options">⋯</button>
          <div class="lockin-note-menu" role="menu">
            <button type="button" data-action="duplicate-note">Duplicate note</button>
            <button type="button" data-action="delete-note" class="danger">Delete note</button>
          </div>
        </div>
      </div>

      <div class="lockin-note-editor-card">
        <div id="lockin-note-editor" class="lockin-note-editor" contenteditable="true" data-placeholder="Write your note here. Add details, context, and your own thoughts…"></div>
      </div>

      <div class="lockin-note-footer-status">
        <span id="lockin-note-status" class="lockin-note-status-text">${escapeHtml(
          noteSaveStatus
        )}</span>
      </div>
    </div>
  `;
}

function buildAllNotesView(isActive) {
  return `
    <div class="lockin-all-notes-view ${isActive ? "is-active" : ""}">
      <div class="lockin-notes-filter-bar">
        <div class="lockin-notes-filter-left">
          <span class="lockin-filter-label">Showing:</span>
          <select class="lockin-notes-filter-select" id="lockin-notes-filter-select">
            <option value="page" ${notesFilter === "page" ? "selected" : ""}>This page</option>
            <option value="course" ${notesFilter === "course" ? "selected" : ""}>This course</option>
            <option value="all" ${notesFilter === "all" ? "selected" : ""}>All notes</option>
            <option value="starred" ${notesFilter === "starred" ? "selected" : ""}>Starred</option>
          </select>
        </div>
        <div class="lockin-notes-search">
          <input id="lockin-notes-search" class="lockin-notes-search-input" placeholder="Search notes…" value="${escapeHtml(
            notesSearchQuery
          )}" />
        </div>
      </div>
      <div class="lockin-notes-list" id="lockin-notes-list">
        ${notesLoading ? '<p class="lockin-empty">Loading...</p>' : ""}
      </div>
    </div>
  `;
}

/**
 * Load and display notes
 */
async function loadNotes(filter = "page") {
  if (!window.LockInAPI || !window.LockInAPI.listNotes) {
    Logger.error("LockInAPI.listNotes is not available");
    return;
  }

  notesFilter = filter;
  notesLoading = true;
  renderNotesList();

  try {
    let params = {};
    if (filter === "page") {
      params.sourceUrl = window.location.href;
    } else if (filter === "course") {
      params.courseCode = activeNote.courseCode || null;
    }
    params.limit = 50;

    const notes = await window.LockInAPI.listNotes(params);
    notesListCache = Array.isArray(notes)
      ? notes.map((note) => normalizeNote(note))
      : [];
    hasLoadedNotes = true;
    notesLoading = false;
    // Sync the active note if it exists in the refreshed list
    if (activeNote?.id) {
      const latest = notesListCache.find((n) => n.id === activeNote.id);
      if (latest) {
        activeNote = { ...latest };
      }
    }
    renderNotesList();
  } catch (error) {
    Logger.error("Failed to load notes:", error);
    notesLoading = false;
    const sidebarElement = lockinWidget?.getSidebarElement();
    const notesList = sidebarElement?.querySelector("#lockin-notes-list");
    if (notesList) {
      notesList.innerHTML =
        '<p class="lockin-empty">Failed to load notes. Please try again.</p>';
    }
  }
}

/**
 * Render notes list
 */
function renderNotesList() {
  const sidebarElement = lockinWidget?.getSidebarElement();
  const listEl = sidebarElement?.querySelector("#lockin-notes-list");
  if (!listEl) return;

  if (notesLoading) {
    listEl.innerHTML = '<p class="lockin-empty">Loading notes...</p>';
    return;
  }

  let filtered = [...notesListCache];
  filtered = filtered.filter((note) => noteMatchesFilter(note, notesFilter));

  const query = notesSearchQuery.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter((note) => {
      const haystack =
        `${note.title || ""} ${stripHtml(note.content || "")}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="lockin-notes-empty">
        <div class="lockin-notes-empty-title">No notes yet for this course.</div>
        <div class="lockin-notes-empty-subtitle">Create one with + New note or save from Chat.</div>
        <button class="lockin-btn-ghost lockin-notes-empty-btn" type="button">+ New note</button>
      </div>
    `;

    const emptyBtn = listEl.querySelector(".lockin-notes-empty-btn");
    if (emptyBtn) {
      emptyBtn.addEventListener("click", () => {
        startNewNote();
        setNotesView("current", sidebarElement);
        populateCurrentNoteFields(sidebarElement);
        const titleInput = sidebarElement?.querySelector("#lockin-note-title");
        titleInput?.focus();
      });
    }
    return;
  }

  const cardsHtml = filtered
    .map((note) => {
      const metaParts = [];
      if (note.courseCode) {
        metaParts.push(note.courseCode);
      }
      const linked = buildLinkedContextLabel(note);
      if (linked.label) {
        metaParts.push(truncateText(linked.label, 40));
      }
      if (note.updatedAt || note.updated_at) {
        metaParts.push(formatHistoryTimestamp(note.updatedAt || note.updated_at));
      }

      const badges = [];
      if (note.noteType && note.noteType !== "manual") {
        badges.push('<span class="lockin-note-badge">AI</span>');
      } else {
        badges.push('<span class="lockin-note-badge">✏</span>');
      }
      if (typeof note.content === "string" && note.content.includes("[ ]")) {
        badges.push('<span class="lockin-note-badge">☑ todos</span>');
      }

      const isActive = activeNote?.id && note.id === activeNote.id;
      return `
        <div class="lockin-note-card ${isActive ? "is-active" : ""}" data-note-id="${note.id || ""}">
          <div class="lockin-note-card-head">
            <div class="lockin-note-card-title">${escapeHtml(
              note.title || "Untitled"
            )}</div>
            <div class="lockin-note-card-badges">${badges.join("")}</div>
          </div>
          <div class="lockin-note-card-snippet">${escapeHtml(
            truncateText(stripHtml(note.content || ""), 160)
          )}</div>
          <div class="lockin-note-card-meta">${escapeHtml(metaParts.join(" · "))}</div>
        </div>
      `;
    })
    .join("");

  listEl.innerHTML = cardsHtml;

  listEl.querySelectorAll(".lockin-note-card").forEach((card) => {
    card.addEventListener("click", () => {
      const noteId = card.getAttribute("data-note-id");
      const nextNote = notesListCache.find((n) => String(n.id) === noteId);
      if (nextNote) {
        activeNote = { ...nextNote };
        noteHasChanges = false;
        setNotesView("current", sidebarElement);
        populateCurrentNoteFields(sidebarElement);
      }
    });
  });
}

function noteMatchesFilter(note, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "page") {
    return normalizeUrl(note.sourceUrl || "") === normalizeUrl(window.location.href);
  }
  if (filter === "course") {
    if (!note.courseCode || !activeNote.courseCode) return true;
    return note.courseCode === activeNote.courseCode;
  }
  if (filter === "starred") {
    return (
      note.is_starred === true ||
      (Array.isArray(note.tags) && note.tags.includes("starred"))
    );
  }
  return true;
}

function buildLinkedContextLabel(note) {
  if (!note) return { label: "", url: "" };
  const label =
    note.sourceSelection ||
    note.linkedLabel ||
    note.courseCode ||
    getLinkedContext().label;
  const url = note.sourceUrl || window.location.href;
  return { label, url };
}

function buildNoteMetaText(note) {
  if (!note) return "";
  const created = note.createdAt || note.created_at;
  const updated = note.updatedAt || note.updated_at;
  const parts = [];
  if (created) {
    parts.push(`Created ${formatHistoryTimestamp(created)}`);
  }
  if (updated) {
    parts.push(`Updated ${formatHistoryTimestamp(updated)}`);
  }
  return parts.join(" · ");
}

function getNotesCourseLabel() {
  if (activeNote?.courseCode) {
    return `${activeNote.courseCode} · This course`;
  }
  return "This course";
}

function createEmptyNote(prefill = {}) {
  const context = getLinkedContext();
  const now = new Date().toISOString();
  return {
    id: prefill.id || null,
    title: prefill.title || "",
    content: prefill.content || "",
    sourceUrl: prefill.sourceUrl || context.sourceUrl,
    courseCode: prefill.courseCode || context.courseCode || null,
    linkedLabel: prefill.linkedLabel || context.label,
    sourceSelection: prefill.sourceSelection || "",
    noteType: prefill.noteType || "manual",
    tags: prefill.tags || [],
    createdAt: prefill.createdAt || now,
    updatedAt: prefill.updatedAt || now,
  };
}

function normalizeNote(rawNote = {}) {
  const normalized = {
    id: rawNote.id || rawNote.note_id || null,
    title: rawNote.title || "Untitled Note",
    content: rawNote.content || "",
    sourceUrl: rawNote.source_url || rawNote.sourceUrl || "",
    courseCode: rawNote.course_code || rawNote.courseCode || null,
    sourceSelection: rawNote.source_selection || rawNote.sourceSelection || "",
    noteType: rawNote.note_type || rawNote.noteType || "manual",
    tags: rawNote.tags || [],
    createdAt: rawNote.created_at || rawNote.createdAt || null,
    updatedAt:
      rawNote.updated_at ||
      rawNote.updatedAt ||
      rawNote.created_at ||
      rawNote.createdAt ||
      null,
  };
  normalized.linkedLabel =
    rawNote.linkedLabel ||
    normalized.sourceSelection ||
    normalized.title ||
    getLinkedContext().label;
  return normalized;
}

function sanitizeNoteContent(html = "") {
  if (typeof html !== "string" || !html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("script,style").forEach((node) => node.remove());
  container.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return container.innerHTML;
}

function stripHtml(html = "") {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || "";
}

function truncateText(text = "", maxLength = 120) {
  const value = text || "";
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength - 1)}…`;
}

function getLinkedContext() {
  const heading =
    document.querySelector("h1, h2")?.textContent?.trim() || document.title;
  return {
    label: heading || window.location.hostname || "This course",
    sourceUrl: window.location.href,
    courseCode: null,
  };
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch (error) {
    return url;
  }
}

/**
 * Build the history section HTML
 */
function buildHistorySection() {
  // Load chats if not already loaded
  if (!hasLoadedChats && !isHistoryLoading) {
    loadRecentChats({ silent: true });
  }

  const listHtml = recentChats.length
    ? recentChats
        .map((chat) => {
          const isActive = chat.id === currentChatId;
          return `
            <div class="lockin-history-item ${
              isActive ? "active" : ""
            }" data-chat-id="${chat.id}">
              <div class="lockin-history-item-content">
                <span class="lockin-history-title">${escapeHtml(
                  chat.title || buildFallbackHistoryTitle(chat)
                )}</span>
                <span class="lockin-history-meta">${escapeHtml(
                  formatHistoryTimestamp(
                    chat.last_message_at || chat.created_at
                  )
                )}</span>
              </div>
              <button class="lockin-history-item-menu" type="button" data-chat-id="${
                chat.id
              }" title="Delete chat" aria-label="Delete chat menu">
                <span class="lockin-menu-dots">&#8230;</span>
              </button>
            </div>
          `;
        })
        .join("")
    : `<p class="lockin-history-empty">${escapeHtml(
        isHistoryLoading ? "Loading chats..." : "No chats yet."
      )}</p>`;

  return `
    <div class="lockin-history-actions">
      <span class="lockin-history-label">Chats</span>
      <button class="lockin-new-chat-btn" type="button" ${
        isChatLoading ? "disabled" : ""
      }>+ New Chat</button>
    </div>
    <div class="lockin-history-list">${listHtml}</div>
  `;
}

/**
 * Apply theme by updating CSS variables
 */
function applyTheme() {
  // Get root element or create one if needed
  let root = document.documentElement;

  // Set CSS variables
  const isDark =
    currentTheme === THEMES.DARK ||
    (currentTheme === THEMES.SYSTEM &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const bgColor = isDark ? "#1a1a1a" : "#ffffff";
  const bgSoft = isDark ? "#2d2d2d" : "#f9fafb";
  const textColor = isDark ? "#e5e5e5" : "#1f2937";
  const borderColor = isDark ? "#404040" : "#e5e7eb";

  root.style.setProperty("--lockin-bg", bgColor);
  root.style.setProperty("--lockin-bg-soft", bgSoft);
  root.style.setProperty("--lockin-text", textColor);
  root.style.setProperty("--lockin-accent", currentAccentColor);
  root.style.setProperty("--lockin-border", borderColor);

  // Re-render sidebar if open
  if (lockinWidget && lockinWidget.isOpen) {
    renderSidebarContent();
  }
}

/**
 * Listen for storage changes (when user toggles in popup or changes settings)
 */
function listenToStorageChanges() {
  if (!Storage) {
    return;
  }

  Storage.onChanged((changes, areaName) => {
    if (areaName === "sync" && changes.highlightingEnabled) {
      highlightingEnabled = changes.highlightingEnabled.newValue;
    }

    // Theme changes
    if (areaName === "sync" && changes[STORAGE_KEYS.THEME]) {
      currentTheme = changes[STORAGE_KEYS.THEME].newValue;
      applyTheme();
    }

    // Accent color changes
    if (areaName === "sync" && changes[STORAGE_KEYS.ACCENT_COLOR]) {
      currentAccentColor = changes[STORAGE_KEYS.ACCENT_COLOR].newValue;
      applyTheme();
    }

    // Active mode changes
    if (areaName === "sync" && changes[STORAGE_KEYS.ACTIVE_MODE]) {
      currentMode = changes[STORAGE_KEYS.ACTIVE_MODE].newValue;
      if (lockinWidget && lockinWidget.isOpen) {
        renderSidebarContent();
      }
    }

    if (areaName === "local" && changes[CHAT_ID_STORAGE_KEY]) {
      currentChatId = changes[CHAT_ID_STORAGE_KEY].newValue || null;
      historyStatusMessage = "";
      if (!currentChatId) {
        chatHistory = [];
      }
      if (lockinWidget && lockinWidget.isOpen) {
        renderSidebarContent();
      }
    }
  });
}

/**
 * Setup event listeners for text selection
 */
function setupEventListeners() {
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyPress);
}

// ===================================
// Selection Handling
// ===================================

/**
 * Handle mouse up events - require Ctrl/Cmd + valid text selection
 */
function handleMouseUp(event) {
  // Check if highlighting is enabled
  if (!highlightingEnabled) {
    Logger.debug("Highlighting is disabled");
    return;
  }

  // Require modifier key (Ctrl on Windows/Linux, Cmd on macOS)
  const hasModifierKey = isMac ? event.metaKey : event.ctrlKey;

  Logger.debug("Mouse up detected", {
    isMac,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    hasModifierKey,
  });

  if (!hasModifierKey) {
    Logger.debug("Modifier key not pressed - ignoring selection");
    return;
  }

  Logger.debug("Modifier key pressed - processing selection");

  setTimeout(() => {
    const validationResult = validateSelection();
    if (!validationResult.valid) {
      Logger.debug("Selection validation failed");
      return;
    }

    Logger.debug("Valid selection detected, triggering AI");

    // Store selection info
    cachedSelection = validationResult.text;
    cachedRect = validationResult.rect;

    determineDefaultMode().then(() => {
      runMode(currentMode);
    });
  }, 50);
}

/**
 * Validate current selection
 * Returns { valid: boolean, text?: string, rect?: DOMRect }
 */
function validateSelection() {
  const selection = window.getSelection();

  // No selection
  if (!selection || selection.rangeCount === 0) {
    return { valid: false };
  }

  const selectedText = selection.toString().trim();

  // Empty or too short
  if (!selectedText || selectedText.length < MIN_SELECTION_LENGTH) {
    return { valid: false };
  }

  // Check if selection is inside input/textarea/contenteditable
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element =
    container.nodeType === 1 ? container : container.parentElement;

  if (
    element &&
    (element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable)
  ) {
    return { valid: false };
  }

  // Valid selection
  const rect = range.getBoundingClientRect();
  return {
    valid: true,
    text: selectedText,
    rect: rect,
  };
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyPress(event) {
  if (event.key === "Escape") {
    closeBubble();
  }
}

// ===================================
// Mode Management
// ===================================

/**
 * Determine which mode to use based on user preferences
 */
async function determineDefaultMode() {
  if (!Storage) {
    currentMode = MODES.EXPLAIN;
    return;
  }

  try {
    const data = await Storage.get([
      "modePreference",
      "defaultMode",
      "lastUsedMode",
      STORAGE_KEYS.ACTIVE_MODE,
    ]);

    // First, check if there's a stored active mode from new system
    if (data[STORAGE_KEYS.ACTIVE_MODE]) {
      currentMode = data[STORAGE_KEYS.ACTIVE_MODE];
      return;
    }

    // Fall back to old system
    const modePref = data.modePreference || "fixed";

    if (modePref === "lastUsed" && data.lastUsedMode) {
      currentMode = data.lastUsedMode;
    } else {
      currentMode = data.defaultMode || MODES.EXPLAIN;
    }
  } catch (error) {
    Logger.warn("Mode determination error:", error);
    currentMode = MODES.EXPLAIN;
  }
}

/**
 * Run the selected mode with cached selection
 */
async function runMode(mode) {
  currentMode = mode;

  // Update lastUsedMode if preference is 'lastUsed'
  if (Storage) {
    try {
      const data = await Storage.get("modePreference");
      if (data.modePreference === "lastUsed") {
        await Storage.set("lastUsedMode", mode);
      }
    } catch (error) {
      Logger.warn("Storage access error:", error);
    }
  }

  const settings = await getSettings();
  sessionPreferences = {
    preferredLanguage: settings.preferredLanguage || "en",
    difficultyLevel: settings.difficultyLevel || "highschool",
  };

  const baseHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
  const userMessage = cachedSelection
    ? {
        role: "user",
        content: `${cachedSelection}`,
      }
    : null;

  // Optimistically show the latest user selection before the API responds
  const optimisticHistory = userMessage
    ? [...baseHistory, userMessage]
    : baseHistory;

  chatHistory = optimisticHistory;
  pendingInputValue = "";
  isChatLoading = true;

  ensureChatBubble();
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: true });

  try {
    const response = await callLockInApi({
      selection: cachedSelection,
      mode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: baseHistory,
      // Always send the latest selection as the user's message so it appears in history
      newUserMessage: cachedSelection || undefined,
    });

    // Handle new response format: { success: boolean, data?: {...}, error?: {...} }
    if (!response.success) {
      throw new Error(response.error?.message || "Request failed");
    }

    const data = response.data;
    if (!data || !data.explanation) {
      throw new Error("Invalid response format: missing explanation");
    }

    // Build chat history from structured response (always include the latest user message)
    chatHistory = userMessage
      ? [...baseHistory, userMessage]
      : [...baseHistory];

    // Add assistant response
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content: data.explanation,
      },
    ];

    // Store the full StudyResponse for note saving
    currentStudyResponse = data;

    // Log notes, todos, tags, and difficulty for now (can be used later)
    if (data.notes && data.notes.length > 0) {
      Logger.debug("Notes received:", data.notes);
    }
    if (data.todos && data.todos.length > 0) {
      Logger.debug("Todos received:", data.todos);
    }
    if (data.tags && data.tags.length > 0) {
      Logger.debug("Tags received:", data.tags);
    }
    Logger.debug("Difficulty:", data.difficulty);

    isChatLoading = false;
    pendingInputValue = "";
    if (response.chatId) {
      currentChatId = response.chatId;
      await setStoredChatId(currentChatId);
    }
    historyStatusMessage = "";
    loadRecentChats({ silent: true });
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    Logger.error("Error processing request:", error);
    isChatLoading = false;

    if (cachedSelection) {
      const friendlyMessage = getAssistantErrorMessage(error);
      const historyWithUser = userMessage
        ? [...baseHistory, userMessage]
        : baseHistory;
      chatHistory =
        !historyWithUser.length && cachedSelection
          ? buildFallbackHistory()
          : historyWithUser;
      chatHistory = [
        ...chatHistory,
        {
          role: "assistant",
          content: friendlyMessage,
        },
      ];
      renderSidebarContent();
      saveSessionForCurrentTab();
    } else {
      // No existing selection context. Surface error in console.
      Logger.error("Error (no selection):", getAssistantErrorMessage(error));
    }
  }
}

/**
 * Get settings from storage
 */
async function getSettings() {
  if (!Storage) {
    return { preferredLanguage: "en", difficultyLevel: "highschool" };
  }

  try {
    const data = await Storage.get(["preferredLanguage", "difficultyLevel"]);
    return {
      preferredLanguage: data.preferredLanguage || "en",
      difficultyLevel: data.difficultyLevel || "highschool",
    };
  } catch (error) {
    Logger.warn("Settings access error:", error);
    return { preferredLanguage: "en", difficultyLevel: "highschool" };
  }
}

async function callLockInApi(payload) {
  if (!API) {
    throw new Error("API module not available");
  }

  try {
    return await API.processText({
      selection: payload.selection ?? cachedSelection,
      mode: payload.mode ?? currentMode,
      targetLanguage:
        payload.targetLanguage || sessionPreferences.preferredLanguage || "en",
      difficultyLevel:
        payload.difficultyLevel ||
        sessionPreferences.difficultyLevel ||
        "highschool",
      chatHistory: payload.chatHistory ?? chatHistory ?? [],
      newUserMessage: payload.newUserMessage,
      chatId:
        typeof payload.chatId !== "undefined" ? payload.chatId : currentChatId,
    });
  } catch (error) {
    // Re-throw with original error code
    throw error;
  }
}

function buildFallbackHistory() {
  if (!cachedSelection) {
    return [];
  }

  return [
    {
      role: "user",
      content: `Original text:\n${cachedSelection}`,
    },
  ];
}

function getAssistantErrorMessage(error) {
  const code = error?.code;
  if (code === "AUTH_REQUIRED" || code === "AUTH_NOT_CONFIGURED") {
    return "Please open the Lock-in popup and sign in to your account before trying again.";
  }
  if (code === "RATE_LIMIT") {
    return "You reached today's request limit. Please try again tomorrow.";
  }
  return (
    error?.message ||
    "I had trouble reaching Lock-in. Please check your connection and try again."
  );
}

function handleFollowUpSubmit() {
  if (isChatLoading) {
    return;
  }

  const trimmed = pendingInputValue.trim();
  if (!trimmed) {
    return;
  }

  pendingInputValue = "";
  sendFollowUpMessage(trimmed);
}

async function sendFollowUpMessage(messageText) {
  chatHistory = [...chatHistory, { role: "user", content: messageText }];
  isChatLoading = true;
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: true });

  try {
    const historyForRequest = chatHistory.slice(0, -1);
    const response = await callLockInApi({
      selection: cachedSelection,
      mode: currentMode,
      targetLanguage: sessionPreferences.preferredLanguage,
      difficultyLevel: sessionPreferences.difficultyLevel,
      chatHistory: historyForRequest,
      newUserMessage: messageText,
      chatId: currentChatId,
    });

    // Handle new response format: { success: boolean, data?: {...}, error?: {...} }
    if (!response.success) {
      throw new Error(response.error?.message || "Request failed");
    }

    const data = response.data;
    if (!data || !data.explanation) {
      throw new Error("Invalid response format: missing explanation");
    }

    // Build chat history: user message is already added, now add assistant response
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content: data.explanation,
      },
    ];

    // Store the full StudyResponse for note saving
    currentStudyResponse = data;

    // Log notes, todos, tags, and difficulty for now (can be used later)
    if (data.notes && data.notes.length > 0) {
      Logger.debug("Notes received:", data.notes);
    }
    if (data.todos && data.todos.length > 0) {
      Logger.debug("Todos received:", data.todos);
    }
    if (data.tags && data.tags.length > 0) {
      Logger.debug("Tags received:", data.tags);
    }
    Logger.debug("Difficulty:", data.difficulty);

    isChatLoading = false;
    if (response.chatId) {
      currentChatId = response.chatId;
      await setStoredChatId(currentChatId);
    }
    historyStatusMessage = "";
    loadRecentChats({ silent: true });
    renderChatBubble();
    saveSessionForCurrentTab();
  } catch (error) {
    Logger.error("Follow-up error:", error);
    isChatLoading = false;
    chatHistory = [
      ...chatHistory,
      {
        role: "assistant",
        content: getAssistantErrorMessage(error),
      },
    ];
    renderChatBubble();
    saveSessionForCurrentTab();
  }
}

// ===================================
// Bubble Display Helpers (LockinSidebar-based)
// ===================================

/**
 * Ensure the sidebar is open and ready to render content.
 */
function ensureChatBubble() {
  if (!lockinWidget) {
    return;
  }

  if (!lockinWidget.isOpen) {
    lockinWidget.open();
  }
}

/**
 * Backwards-compatible helper used throughout older code paths.
 * Delegates to the new sidebar-based renderer.
 */
function renderChatBubble() {
  renderSidebarContent();
}

function scrollChatToBottom() {
  if (!lockinWidget) {
    return;
  }

  const sidebarElement = lockinWidget.getSidebarElement();
  if (!sidebarElement) {
    return;
  }

  // Use double requestAnimationFrame for more reliable scrolling
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const messagesEl = sidebarElement.querySelector("#lockin-chat-messages");
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  });
}

function buildChatMessagesHtml(messages) {
  const filtered = (messages || []).filter(
    (message) => message.role !== "system"
  );

  if (filtered.length === 0) {
    const placeholderText = isChatLoading
      ? "Lock-in is thinking..."
      : "Highlight text and choose a mode to start chatting.";
    return `<div class="lockin-chat-placeholder">${escapeHtml(
      placeholderText
    )}</div>`;
  }

  const rendered = filtered
    .map((message, index) => {
      const roleClass =
        message.role === "user"
          ? "lockin-chat-msg-user"
          : "lockin-chat-msg-assistant";

      // Add action buttons for all assistant messages
      let actions = "";
      if (message.role === "assistant") {
        const messageId = `msg-${index}`;
        actions = `
          <div class="lockin-chat-msg-actions">
            <button class="lockin-chat-action-btn" data-action="save-note" data-message-id="${messageId}" title="Save this response as a note">Save as note</button>
            <button class="lockin-chat-action-btn" data-action="generate-notes" data-message-id="${messageId}" title="Generate structured notes from this response">Generate notes</button>
          </div>
        `;
      }

      return `
        <div class="lockin-chat-msg ${roleClass}">
          <div class="lockin-chat-bubble">${escapeHtml(message.content)}</div>
          ${actions}
        </div>
      `;
    })
    .join("");

  if (isChatLoading) {
    return (
      rendered +
      `
      <div class="lockin-chat-msg lockin-chat-msg-assistant lockin-chat-msg-pending">
        <div class="lockin-chat-bubble">
          <span class="lockin-dots"></span>Lock-in is thinking...
        </div>
      </div>
    `
    );
  }

  return rendered;
}

/**
 * Show AI-generated note suggestions in a draft panel (called only on-demand)
 */
function showAiDraftNotes() {
  if (
    !currentStudyResponse ||
    !currentStudyResponse.notes ||
    currentStudyResponse.notes.length === 0
  ) {
    showToast(
      "No notes were generated. Try asking with more specific details.",
      "info"
    );
    return;
  }

  const sidebarElement = lockinWidget?.getSidebarElement();
  if (!sidebarElement) return;

  const notesSection = sidebarElement.querySelector(".lockin-notes-shell");
  if (!notesSection) return;

  clearAiDraftPanel();
  setNotesView("current", sidebarElement);

  const notes = currentStudyResponse.notes;
  const draftBullets = notes
    .map((note) => {
      const title = escapeHtml(note.title || "");
      return `<li class="lockin-draft-note-item">${title}</li>`;
    })
    .join("");

  const draftPanel = document.createElement("div");
  draftPanel.className = "lockin-ai-draft-panel";
  draftPanel.innerHTML = `
    <div class="lockin-draft-panel-header">
      <h3>AI draft notes from your last question</h3>
      <button class="lockin-draft-panel-close" type="button" aria-label="Close draft">X</button>
    </div>
    <div class="lockin-draft-panel-content">
      <ul class="lockin-draft-notes-list">
        ${draftBullets}
      </ul>
    </div>
    <div class="lockin-draft-panel-actions">
      <button class="lockin-btn-secondary" data-action="insert-draft">Insert into current note</button>
      <button class="lockin-btn-primary" data-action="save-draft-separate">Save each as separate note</button>
      <button class="lockin-btn-ghost" data-action="dismiss-draft">Dismiss</button>
    </div>
  `;

  const body = notesSection.querySelector(".lockin-notes-body");
  const currentView = notesSection.querySelector(".lockin-note-current-view");
  if (body) {
    body.insertBefore(draftPanel, currentView || body.firstChild);
  }
}

/**
 * Clear AI draft notes panel
 */
function clearAiDraftPanel() {
  const sidebarElement = lockinWidget?.getSidebarElement();
  if (!sidebarElement) return;

  const draftPanel = sidebarElement.querySelector(".lockin-ai-draft-panel");
  if (draftPanel) {
    draftPanel.remove();
  }
}

/**
 * Placeholder function for Save as note action
 * Called when user clicks "Save as note" on a chat message
 */
function onSaveAsNote(messageId, messageContent) {
  const sidebarElement = lockinWidget?.getSidebarElement();
  if (!sidebarElement) return;

  const safeContent = escapeHtml(messageContent || "").replace(/\n/g, "<br>");
  const firstSentence = messageContent.split(".")[0].trim();
  const title =
    firstSentence.length > 60
      ? `${firstSentence.substring(0, 60)}…`
      : firstSentence || "Untitled note";

  activeNote = createEmptyNote({
    title,
    content: safeContent,
    sourceSelection: cachedSelection || "",
  });
  noteHasChanges = true;
  noteSaveStatus = "Saving...";

  if (lockinWidget) {
    lockinWidget.switchTab("notes");
  }

  setNotesView("current", sidebarElement);
  populateCurrentNoteFields(sidebarElement);
  scheduleNoteSave();

  const editorEl = sidebarElement.querySelector("#lockin-note-editor");
  editorEl?.focus();
  showToast("Ready to save! Editing now autosaves.");
}

/**
 * Handle Generate notes action
 * Called when user clicks "Generate notes" on a chat message
 * Switches to Notes tab and shows AI draft panel
 */
function onGenerateNotes(messageId, messageContent) {
  // Switch to Notes tab first (same as "Save as note")
  if (lockinWidget) {
    lockinWidget.switchTab("notes");
  }
  setNotesView("current", lockinWidget?.getSidebarElement());
  
  // Then show the AI draft notes panel
  showAiDraftNotes();
}

/**
 * Save AI-drafted notes as separate notes
 */
async function saveDraftNotesAsSeparate() {
  if (
    !currentStudyResponse ||
    !currentStudyResponse.notes ||
    currentStudyResponse.notes.length === 0
  ) {
    Logger.error("No notes to save");
    return;
  }

  if (!window.LockInAPI || !window.LockInAPI.createNote) {
    Logger.error("LockInAPI.createNote is not available");
    return;
  }

  try {
    const savePromises = [];

    for (const note of currentStudyResponse.notes) {
      const title = (note.title || "Untitled Note").trim();
      const content = (note.content || "").trim();

      if (!content) continue; // Skip empty notes

      const noteData = {
        title: title,
        content: content,
        sourceSelection: cachedSelection || "",
        sourceUrl: window.location.href,
        courseCode: null,
        noteType: note.type || "general",
        tags: currentStudyResponse.tags || [],
      };

      savePromises.push(window.LockInAPI.createNote(noteData));
    }

    await Promise.all(savePromises);
    Logger.debug("All AI draft notes saved successfully");

    clearAiDraftPanel();
    showToast(`Saved ${savePromises.length} notes!`);
    await loadNotes(notesFilter);
  } catch (error) {
    Logger.error("Failed to save some notes:", error);
    showToast("Failed to save some notes. Please try again.", "error");
  }
}

/**
 * Insert AI-drafted notes into current note editor
 */
function insertDraftIntoCurrent() {
  if (
    !currentStudyResponse ||
    !currentStudyResponse.notes ||
    currentStudyResponse.notes.length === 0
  ) {
    return;
  }

  const sidebarElement = lockinWidget?.getSidebarElement();
  if (!sidebarElement) return;

  const editorEl = sidebarElement.querySelector("#lockin-note-editor");
  if (!editorEl) return;

  const bulletList = currentStudyResponse.notes
    .map((note) => `<li>${escapeHtml((note.title || "").trim())}</li>`)
    .filter((item) => item.length > 8)
    .join("");

  if (bulletList) {
    const currentContent = editorEl.innerHTML.trim();
    const listHtml = `<ul>${bulletList}</ul>`;
    editorEl.innerHTML = currentContent
      ? `${currentContent}<br><br>${listHtml}`
      : listHtml;
    activeNote.content = editorEl.innerHTML;
    noteHasChanges = true;
    scheduleNoteSave();

    clearAiDraftPanel();
    editorEl.focus();
    showToast("Draft notes inserted!");
  }
}

/**
 * Show a toast notification
 */
function showToast(message, type = "success") {
  // Simple toast implementation - can be enhanced later
  const toast = document.createElement("div");
  toast.className = `lockin-toast lockin-toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === "error" ? "#ef4444" : "#10b981"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    animation: lockin-toast-slide-in 0.3s ease-out;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "lockin-toast-slide-out 0.3s ease-in";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Build the mode selector UI (expandable)
 * Shows current mode with chevron, expandable to show other modes
 */
function buildModeSelector() {
  const modeInfo = MODE_CONFIG[currentMode];
  const otherModes = Object.keys(MODES)
    .map((key) => MODES[key])
    .filter((mode) => mode !== currentMode);

  const otherModesHtml = otherModes
    .map((mode) => {
      const info = MODE_CONFIG[mode];
      return `
      <button class="lockin-mode-option" type="button" data-mode="${mode}" title="Switch to ${info.label}">
        <span class="lockin-mode-option-icon">${info.icon}</span>
        <span class="lockin-mode-option-label">${info.label}</span>
      </button>
    `;
    })
    .join("");

  return `
    <div class="lockin-mode-selector-container">
      <button class="lockin-mode-pill" type="button" title="Current mode">
        <span class="lockin-mode-icon">${modeInfo.icon}</span>
        <span class="lockin-mode-label">${modeInfo.label}</span>
        <span class="lockin-mode-chevron">&#9660;</span>
      </button>
      <div class="lockin-mode-expandable" style="display: none;">
        ${otherModesHtml}
      </div>
    </div>
  `;
}

function buildHistoryPanelHtml() {
  const panelState = isHistoryPanelOpen ? "open" : "collapsed";
  const statusHtml = historyStatusMessage
    ? `<p class="lockin-history-status">${escapeHtml(historyStatusMessage)}</p>`
    : "";
  const listHtml = recentChats.length
    ? recentChats
        .map((chat) => {
          const isActive = chat.id === currentChatId;
          return `
            <div class="lockin-history-item ${
              isActive ? "active" : ""
            }" data-chat-id="${chat.id}">
              <div class="lockin-history-item-content">
                <span class="lockin-history-title">${escapeHtml(
                  chat.title || buildFallbackHistoryTitle(chat)
                )}</span>
                <span class="lockin-history-meta">${escapeHtml(
                  formatHistoryTimestamp(
                    chat.last_message_at || chat.created_at
                  )
                )}</span>
              </div>
              <button class="lockin-history-item-menu" type="button" data-chat-id="${
                chat.id
              }" title="Delete chat" aria-label="Delete chat menu">
                <span class="lockin-menu-dots">&#8230;</span>
              </button>
            </div>
          `;
        })
        .join("")
    : `<p class="lockin-history-empty">${escapeHtml(
        isHistoryLoading ? "Loading chats..." : "No chats yet."
      )}</p>`;

  return `
    <aside class="lockin-history-panel ${panelState}">
      <div class="lockin-history-actions">
        <span class="lockin-history-label">Chats</span>
        <button class="lockin-new-chat-btn" type="button" ${
          isChatLoading ? "disabled" : ""
        }>+ New Chat</button>
      </div>
      ${statusHtml}
      <div class="lockin-history-list">${listHtml}</div>
      ${buildUserProfileBlock()}
    </aside>
  `;
}

/**
 * Build user profile card at the bottom of the sidebar
 */
function buildUserProfileBlock() {
  const initials = userProfile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return `
    <div class="lockin-profile-section">
      <button class="lockin-profile-card" type="button" title="User settings">
        <div class="lockin-profile-avatar">${escapeHtml(initials)}</div>
        <div class="lockin-profile-info">
          <div class="lockin-profile-name">${escapeHtml(userProfile.name)}</div>
          <div class="lockin-profile-plan">${escapeHtml(userProfile.plan)}</div>
        </div>
      </button>
      <div class="lockin-profile-menu" style="display: none;">
        ${buildProfileMenu()}
      </div>
    </div>
  `;
}

/**
 * Build profile menu options
 */
function buildProfileMenu() {
  return `
    <button class="lockin-profile-menu-item" type="button" data-action="upgrade">
      Upgrade plan
    </button>
    <button class="lockin-profile-menu-item" type="button" data-action="personalisation">
      Personalisation
    </button>
    <button class="lockin-profile-menu-item" type="button" data-action="settings">
      Settings
    </button>
    <button class="lockin-profile-menu-item" type="button" data-action="help">
      Help
    </button>
    <div class="lockin-profile-menu-divider"></div>
    <button class="lockin-profile-menu-item lockin-profile-menu-logout" type="button" data-action="logout">
      Log out
    </button>
  `;
}

function buildFallbackHistoryTitle(chat) {
  // Prefer shared utility if available for easier testing.
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.buildFallbackHistoryTitle === "function"
  ) {
    return LockInChatHistoryUtils.buildFallbackHistoryTitle(chat);
  }

  if (!chat) {
    return "Untitled chat";
  }
  const timestamp = chat.created_at || chat.updated_at;
  if (!timestamp) {
    return "Untitled chat";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Untitled chat";
  }
  return `Chat from ${date.toISOString().split("T")[0]}`;
}

function formatHistoryTimestamp(timestamp) {
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.formatHistoryTimestamp === "function"
  ) {
    return LockInChatHistoryUtils.formatHistoryTimestamp(timestamp);
  }

  if (!timestamp) {
    return "Just now";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) {
    return minutes <= 1 ? "Just now" : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString();
}

async function handleNewChatRequest() {
  await startNewChat("New chat ready. Highlight text to start.");
}

async function startNewChat(statusMessage) {
  currentChatId = null;
  chatHistory = [];
  pendingInputValue = "";
  await setStoredChatId(null);
  historyStatusMessage = statusMessage || "";
  isChatLoading = false;
  renderChatBubble();
  saveSessionForCurrentTab({ isLoadingOverride: false });
}

async function handleHistorySelection(chatId) {
  if (!chatId) {
    return;
  }
  historyStatusMessage = "Loading chat...";
  renderChatBubble();
  try {
    const rows = await fetchChatMessagesFromApi(chatId);
    const restoredHistory = convertRowsToChatHistory(rows);
    chatHistory = restoredHistory.length
      ? restoredHistory
      : [
          {
            role: "assistant",
            content: "This chat is empty. Highlight text to add a message.",
          },
        ];
    currentChatId = chatId;
    pendingInputValue = "";
    await setStoredChatId(chatId);
    historyStatusMessage = "";
    isChatLoading = false;
    renderChatBubble();
    saveSessionForCurrentTab({ isLoadingOverride: false });
    loadRecentChats({ silent: true });
  } catch (error) {
    Logger.error("Chat load error:", error);
    historyStatusMessage =
      error?.message || "Unable to load that chat. Please try again.";
    renderChatBubble();
  }
}
function showDeleteDropdown(menuBtn, chatId) {
  // Remove any existing dropdown
  const existingDropdown = document.querySelector(".lockin-delete-dropdown");
  if (existingDropdown) {
    existingDropdown.remove();
  }

  // Create dropdown menu
  const dropdown = document.createElement("div");
  dropdown.className = "lockin-delete-dropdown";
  dropdown.innerHTML = `
    <button class="lockin-delete-dropdown-item" type="button" data-chat-id="${chatId}">
      <span class="lockin-delete-dropdown-icon">&#128465;</span>
      <span class="lockin-delete-dropdown-text">Delete</span>
    </button>
  `;

  // Position dropdown near the menu button
  const rect = menuBtn.getBoundingClientRect();
  dropdown.style.top = rect.bottom + 4 + "px";
  dropdown.style.left = rect.right - 140 + "px";
  dropdown.style.zIndex = "10001";

  document.body.appendChild(dropdown);

  // Handle delete click
  dropdown
    .querySelector(".lockin-delete-dropdown-item")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.remove();
      handleDeleteChat(chatId);
    });

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener("click", closeDropdown);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", closeDropdown);
  }, 0);
}

async function handleDeleteChat(chatId) {
  if (!API) {
    alert("Please sign in to delete chats.");
    return;
  }

  try {
    await API.deleteChat(chatId);

    // If deleted chat is currently open, switch to new chat
    if (currentChatId === chatId) {
      await startNewChat("Chat deleted. Starting new chat.");
    }

    loadRecentChats({ silent: true });
  } catch (error) {
    Logger.error("Error deleting chat:", error);
    alert("Failed to delete chat. Please try again.");
  }
}

async function loadRecentChats(options = {}) {
  if (isHistoryLoading) {
    return;
  }

  const silent = options.silent === true;

  if (!API) {
    if (!silent) {
      historyStatusMessage = "Sign in via the popup to see your chats.";
      if (lockinWidget && lockinWidget.isOpen) {
        renderSidebarContent();
      }
    }
    return;
  }

  isHistoryLoading = true;
  if (!silent) {
    historyStatusMessage = "Loading chats...";
    if (lockinWidget && lockinWidget.isOpen) {
      renderSidebarContent();
    }
  }

  try {
    const data = await API.getRecentChats({ limit: RECENT_CHAT_LIMIT });
    recentChats = Array.isArray(data) ? data : [];
    hasLoadedChats = true;
    if (!silent) {
      historyStatusMessage = recentChats.length
        ? ""
        : "Start a new chat to see it here.";
    }
  } catch (error) {
    Logger.error("Recent chats error:", error);
    if (!silent) {
      historyStatusMessage =
        error?.message || "Unable to load chats right now.";
    }
  } finally {
    isHistoryLoading = false;
    hasLoadedChats = true;
    if (lockinWidget && lockinWidget.isOpen) {
      renderSidebarContent();
    }
  }
}

async function fetchChatMessagesFromApi(chatId) {
  if (!API) {
    throw new Error("API module not available");
  }

  try {
    return await API.getChatMessages(chatId);
  } catch (error) {
    throw error;
  }
}

function convertRowsToChatHistory(rows = []) {
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.convertRowsToChatHistory === "function"
  ) {
    return LockInChatHistoryUtils.convertRowsToChatHistory(rows);
  }

  return rows
    .map((row) => {
      const role = row.role || "assistant";
      const text =
        role === "assistant"
          ? row.output_text || ""
          : row.input_text || row.output_text || "";
      if (!text) {
        return null;
      }
      return { role, content: text };
    })
    .filter(Boolean);
}

// Duplicate function removed - using the one above that works with sidebar

// Legacy standalone error bubble and manual positioning have been removed.

// ===================================
// Per-Tab Session Management
// ===================================

/**
 * Get current tab ID from background script
 */
async function getTabId() {
  if (!Messaging || !chrome.runtime) return;

  try {
    const message = Messaging.createMessage(Messaging.MESSAGE_TYPES.GET_TAB_ID);
    const response = await Messaging.sendMessage(message);
    if (response.ok && response.data) {
      currentTabId = response.data.tabId;
      Logger.debug("Tab ID:", currentTabId);
    }
  } catch (error) {
    Logger.error("Failed to get tab ID:", error);
  }
}

/**
 * Load session for current tab
 */
async function loadSessionForCurrentTab() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.GET_SESSION
    );
    const response = await Messaging.sendMessage(message);
    if (!response.ok) {
      return;
    }
    const session = response.data?.session;

    // No session exists
    if (!session || !session.isActive) return;

    // Check if origin matches
    if (session.origin !== currentOrigin) {
      Logger.debug("Origin changed, not restoring session");
      await clearSessionForCurrentTab();
      return;
    }

    // Check if user explicitly closed it
    if (session.isClosed) {
      Logger.debug("Session was closed by user");
      return;
    }

    Logger.debug("Restoring session for tab", currentTabId);

    cachedSelection = session.selection || "";
    currentMode = session.mode || "explain";
    sessionPreferences = {
      preferredLanguage: session.targetLanguage || "en",
      difficultyLevel: session.difficultyLevel || "highschool",
    };

    let restoredHistory = Array.isArray(session.chatHistory)
      ? session.chatHistory
      : [];

    if (!restoredHistory.length && session.data) {
      restoredHistory = migrateLegacySession(session);
    }

    chatHistory = restoredHistory;
    pendingInputValue = "";
    isChatLoading = !!session.isLoading;
    if (session.chatId) {
      currentChatId = session.chatId;
      setStoredChatId(session.chatId);
    }

    if (!chatHistory.length && isChatLoading && cachedSelection) {
      runMode(currentMode);
      return;
    }

    if (chatHistory.length) {
      ensureChatBubble();
      renderChatBubble();
    }
  } catch (error) {
    Logger.error("Failed to load session:", error);
  }
}

function migrateLegacySession(session) {
  if (!session || !session.data) {
    return [];
  }

  const legacyHistory = [];

  if (session.selection) {
    legacyHistory.push({
      role: "user",
      content: `Original text:\n${session.selection}`,
    });
  }

  const parts = [];
  if (session.data.answer) {
    parts.push(session.data.answer);
  }
  if (session.data.example) {
    parts.push(`Example:\n${session.data.example}`);
  }
  if (session.data.explanation) {
    parts.push(`Explanation:\n${session.data.explanation}`);
  }

  if (parts.length) {
    legacyHistory.push({
      role: "assistant",
      content: parts.join("\n\n"),
    });
  }

  return legacyHistory;
}

function listenToAuthChanges() {
  if (
    !window.LockInAuth ||
    typeof window.LockInAuth.onSessionChanged !== "function"
  ) {
    return;
  }

  window.LockInAuth.onSessionChanged((session) => {
    if (session && session.accessToken) {
      return;
    }
    currentChatId = null;
    recentChats = [];
    historyStatusMessage = "";
    hasLoadedChats = false;
    setStoredChatId(null);
    if (lockinWidget && lockinWidget.isOpen) {
      renderBubbleContent();
    }
  });
}

async function loadStoredChatId() {
  if (!Storage) {
    currentChatId = null;
    return null;
  }

  try {
    const data = await Storage.getLocal(CHAT_ID_STORAGE_KEY);
    currentChatId = data[CHAT_ID_STORAGE_KEY] || null;
    return currentChatId;
  } catch (error) {
    Logger.warn("Failed to load chat ID:", error);
    currentChatId = null;
    return null;
  }
}

async function setStoredChatId(chatId) {
  if (!Storage) {
    currentChatId = chatId || null;
    return;
  }

  try {
    if (!chatId) {
      await Storage.removeLocal(CHAT_ID_STORAGE_KEY);
    } else {
      await Storage.setLocal(CHAT_ID_STORAGE_KEY, chatId);
    }
    currentChatId = chatId || null;
  } catch (error) {
    Logger.warn("Failed to save chat ID:", error);
  }
}

/**
 * Save session for current tab
 */
async function saveSessionForCurrentTab(options = {}) {
  if (!chrome.runtime || !currentTabId) return;

  const sessionData = {
    tabId: currentTabId,
    origin: currentOrigin,
    isActive: true,
    isClosed: false,
    timestamp: Date.now(),
    isLoading:
      typeof options.isLoadingOverride === "boolean"
        ? options.isLoadingOverride
        : isChatLoading,
    selection: cachedSelection,
    mode: currentMode,
    chatHistory: chatHistory,
    chatId: currentChatId,
    targetLanguage: sessionPreferences.preferredLanguage,
    difficultyLevel: sessionPreferences.difficultyLevel,
  };

  if (!Messaging || !chrome.runtime) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.SAVE_SESSION,
      { sessionData }
    );
    await Messaging.sendMessage(message);
  } catch (error) {
    Logger.error("Failed to save session:", error);
  }
}

/**
 * Update just the position/size in the current session
 */
async function updateSessionPosition() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    // Get current session
    const getMessage = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.GET_SESSION
    );
    const getResponse = await Messaging.sendMessage(getMessage);
    if (getResponse.ok && getResponse.data?.session) {
      const session = getResponse.data.session;
      const saveMessage = Messaging.createMessage(
        Messaging.MESSAGE_TYPES.SAVE_SESSION,
        { sessionData: session }
      );
      await Messaging.sendMessage(saveMessage);
    }
  } catch (error) {
    Logger.error("Failed to update session position:", error);
  }
}

/**
 * Clear session for current tab
 */
async function clearSessionForCurrentTab() {
  if (!Messaging || !chrome.runtime || !currentTabId) return;

  try {
    const message = Messaging.createMessage(
      Messaging.MESSAGE_TYPES.CLEAR_SESSION
    );
    await Messaging.sendMessage(message);
  } catch (error) {
    Logger.error("Failed to clear session:", error);
  }
}

/**
 * Close bubble and mark session as closed
 */
async function closeBubble() {
  if (lockinWidget) {
    lockinWidget.close();
  }
}

// ===================================
// Utility Functions
// ===================================

/**
 * Handle profile menu actions
 */
function handleProfileMenuAction(action) {
  switch (action) {
    case "upgrade":
      Logger.debug("TODO: Handle upgrade plan action");
      break;
    case "personalisation":
      isPersonalisationPanelOpen = !isPersonalisationPanelOpen;
      renderPersonalisationPanel();
      break;
    case "settings":
      Logger.debug("TODO: Handle settings action");
      break;
    case "help":
      Logger.debug("TODO: Handle help action");
      break;
    case "logout":
      handleLogout();
      break;
    default:
      Logger.debug(`Unknown profile action: ${action}`);
  }
}

/**
 * Handle logout
 */
function handleLogout() {
  // Call existing auth logout if available
  if (window.LockInAuth && typeof window.LockInAuth.logout === "function") {
    window.LockInAuth.logout();
  } else {
    Logger.debug("Logout handler not available");
  }
}

/**
 * Render personalisation panel
 */
function renderPersonalisationPanel() {
  // TODO: Implement personalisation panel UI
  Logger.debug("Opening personalisation panel");
}

/**
 * Get mode info (icon and label)
 */
function getModeInfo(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG[MODES.EXPLAIN];
}

/**
 * Set current mode as default
 */
async function setAsDefault(mode) {
  if (!Storage) {
    return;
  }

  try {
    await Storage.set({
      defaultMode: mode,
      modePreference: "fixed",
    });

    const btn =
      lockinWidget && lockinWidget.getBubbleElement()
        ? lockinWidget.getBubbleElement().querySelector(".lockin-set-default")
        : null;
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span style="font-size: 11px;">&check;</span>';
    btn.style.color = "#10b981";
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.color = "";
    }, 1500);
  } catch (error) {
    Logger.warn("Failed to set default mode:", error);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (
    LockInChatHistoryUtils &&
    typeof LockInChatHistoryUtils.escapeHtml === "function"
  ) {
    return LockInChatHistoryUtils.escapeHtml(text);
  }

  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===================================
// Safe Initialization
// ===================================
function safeInit() {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
    init();
  } else {
    Logger.warn("Chrome extension API not available");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInit);
} else {
  safeInit();
}
