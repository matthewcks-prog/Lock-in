/**
 * Lock-in Sidebar System
 *
 * Replaces the floating draggable bubble with a fixed right-hand sidebar panel.
 * Features:
 * - Fixed panel on right side of screen
 * - Shrinks page content on desktop (> 1024px)
 * - Overlays page content on mobile (<= 1024px)
 * - Smooth expand/collapse animation
 * - Pill button when collapsed
 * - Full chat + history functionality
 */

class LockinSidebar {
  constructor(options = {}) {
    // Fixed width: left side 70%, right side 30%
    this.config = {
      sidebarWidth: 30, // 30% of viewport (fixed)
      expandDuration: 300,
      collapseDuration: 300,
      ...options,
    };

    // State
    this.isOpen = false;
    this.isDesktopMode = window.innerWidth > 1024;
    this.activeTab = "chat"; // "chat" or "notes"
    this.isHistoryPanelOpen = false; // Chat history panel state

    // DOM elements
    this.rootElement = null;
    this.togglePill = null;
    this.sidebarElement = null;
    this.topBarElement = null; // Combined mode + tabs bar
    this.chatContainerElement = null; // Container for chat view (history + main)
    this.chatHistoryPanelElement = null; // Left history panel
    this.chatMainElement = null; // Main chat area
    this.notesElement = null; // Notes view

    // Bind methods
    this.handlePillClick = this.handlePillClick.bind(this);
    this.handleMinimizeClick = this.handleMinimizeClick.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleTextSelection = this.handleTextSelection.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleHistoryItemClick = this.handleHistoryItemClick.bind(this);
    this.handleNewChatClick = this.handleNewChatClick.bind(this);
    this.handleModeOptionClick = this.handleModeOptionClick.bind(this);
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleHistoryToggle = this.handleHistoryToggle.bind(this);
  }

  /**
   * Initialize the sidebar on page load
   */
  init() {
    console.log("Lock-in Sidebar: Initializing");
    this.createDOM();
    this.restoreState();
    this.attachEventListeners();
    this.updateResponsiveMode();
    console.log("Lock-in Sidebar: Initialized, isOpen:", this.isOpen);
  }

  /**
   * Create the DOM structure for sidebar
   */
  createDOM() {
    // Remove existing if present
    const existing = document.getElementById("lockin-root");
    if (existing) {
      existing.remove();
    }

    // Root container
    this.rootElement = document.createElement("div");
    this.rootElement.id = "lockin-root";

    // Toggle pill (for collapsed state)
    this.togglePill = document.createElement("button");
    this.togglePill.id = "lockin-toggle-pill";
    this.togglePill.type = "button";
    this.togglePill.setAttribute("aria-label", "Open Lock-in sidebar");
    this.togglePill.innerHTML = "&#128274;";

    // Sidebar container
    this.sidebarElement = document.createElement("aside");
    this.sidebarElement.id = "lockin-sidebar";
    this.sidebarElement.setAttribute(
      "data-state",
      this.isOpen ? "expanded" : "collapsed"
    );
    this.sidebarElement.setAttribute("role", "complementary");
    this.sidebarElement.setAttribute("aria-label", "Lock-in Assistant Sidebar");

    // Minimal top bar (tabs + close button)
    this.topBarElement = document.createElement("header");
    this.topBarElement.className = "lockin-top-bar";
    this.topBarElement.innerHTML = `
      <div class="lockin-top-bar-left">
        <div class="lockin-tabs-wrapper">
          <button class="lockin-tab lockin-tab-active" data-tab="chat" type="button">Chat</button>
          <button class="lockin-tab" data-tab="notes" type="button">Notes</button>
        </div>
      </div>
      <button class="lockin-close-btn" aria-label="Close sidebar" type="button" title="Close">&#10005;</button>
    `;

    // Chat container (holds history panel + main chat area)
    this.chatContainerElement = document.createElement("div");
    this.chatContainerElement.className = "lockin-chat-container";
    
    // Chat history panel (left side, toggleable)
    this.chatHistoryPanelElement = document.createElement("aside");
    this.chatHistoryPanelElement.className = "lockin-chat-history-panel";
    this.chatHistoryPanelElement.setAttribute("data-state", "closed");
    
    // Main chat area (right side)
    this.chatMainElement = document.createElement("section");
    this.chatMainElement.className = "lockin-chat-main";
    
    // Add header with history toggle button and mode selector
    const chatHeader = document.createElement("div");
    chatHeader.className = "lockin-chat-header";
    chatHeader.innerHTML = `
      <div class="lockin-chat-header-left">
        <button class="lockin-history-toggle-btn" type="button" aria-label="Toggle chat history" title="Chat history">
          <span class="lockin-history-toggle-icon">☰</span>
        </button>
        <div class="lockin-mode-selector-wrapper"></div>
      </div>
    `;
    this.chatMainElement.appendChild(chatHeader);
    
    // Chat content area
    const chatContent = document.createElement("div");
    chatContent.className = "lockin-chat-content";
    this.chatMainElement.appendChild(chatContent);
    
    // Assemble chat container
    this.chatContainerElement.appendChild(this.chatHistoryPanelElement);
    this.chatContainerElement.appendChild(this.chatMainElement);

    // Notes section
    this.notesElement = document.createElement("section");
    this.notesElement.className = "lockin-notes-container";
    this.notesElement.style.display = "none";

    // Append to sidebar
    this.sidebarElement.appendChild(this.topBarElement);
    this.sidebarElement.appendChild(this.chatContainerElement);
    this.sidebarElement.appendChild(this.notesElement);

    // Append to root
    this.rootElement.appendChild(this.sidebarElement);
    this.rootElement.appendChild(this.togglePill);

    // Append to body
    if (document.body) {
      document.body.appendChild(this.rootElement);
      console.log("Lock-in Sidebar: DOM appended to body");
    } else {
      document.documentElement.appendChild(this.rootElement);
      console.log("Lock-in Sidebar: DOM appended to documentElement");
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toggle pill click
    this.togglePill.addEventListener("click", this.handlePillClick);

    // Close button click
    const closeBtn = this.topBarElement.querySelector(".lockin-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", this.handleMinimizeClick);
    }
    
    // History toggle button
    const historyToggleBtn = this.chatMainElement.querySelector(".lockin-history-toggle-btn");
    if (historyToggleBtn) {
      historyToggleBtn.addEventListener("click", this.handleHistoryToggle);
    }

    // Window resize for responsive behavior
    window.addEventListener("resize", this.handleWindowResize);

    // Keyboard shortcuts (Escape to close)
    document.addEventListener("keydown", this.handleKeyPress);

    // Text selection for auto-open (optional)
    document.addEventListener("mouseup", this.handleTextSelection);
    document.addEventListener("keyup", this.handleTextSelection);
  }

  /**
   * Handle pill click
   */
  handlePillClick(e) {
    e.stopPropagation();
    this.open();
  }

  /**
   * Handle minimize button click
   */
  handleMinimizeClick(e) {
    e.stopPropagation();
    this.close();
  }

  /**
   * Handle window resize for responsive mode
   */
  handleWindowResize() {
    const wasDesktopMode = this.isDesktopMode;
    this.updateResponsiveMode();
    if (wasDesktopMode !== this.isDesktopMode) {
      this.adjustPageMargin();
    }
  }

  /**
   * Handle text selection (for future: auto-open feature)
   */
  handleTextSelection() {
    const selection = window.getSelection().toString().trim();
    if (selection.length > 3 && !this.isOpen) {
      // Optionally dispatch event for content script to handle
      window.dispatchEvent(
        new CustomEvent("lockin:textSelected", { detail: { text: selection } })
      );
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyPress(e) {
    if (e.key === "Escape" && this.isOpen) {
      e.preventDefault();
      this.close();
    }
  }

  /**
   * Handle history item click
   */
  handleHistoryItemClick(e) {
    e.stopPropagation();
    const chatId = e.currentTarget.getAttribute("data-chat-id");
    if (chatId) {
      window.dispatchEvent(
        new CustomEvent("lockin:selectChat", { detail: { chatId } })
      );
    }
  }

  /**
   * Handle new chat button click
   */
  handleNewChatClick(e) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("lockin:newChat"));
  }

  /**
   * Handle mode option click
   */
  handleModeOptionClick(e) {
    e.stopPropagation();
    const mode = e.currentTarget.getAttribute("data-mode");
    if (mode) {
      window.dispatchEvent(
        new CustomEvent("lockin:switchMode", { detail: { mode } })
      );
    }
  }

  /**
   * Handle tab click
   */
  handleTabClick(e) {
    e.stopPropagation();
    const tab = e.currentTarget.getAttribute("data-tab");
    if (tab && tab !== this.activeTab) {
      this.switchTab(tab);
    }
  }

  /**
   * Switch between chat and notes tabs
   */
  switchTab(tab) {
    this.activeTab = tab;

    // Update tab buttons
    const tabButtons = this.topBarElement.querySelectorAll(".lockin-tab");
    tabButtons.forEach((btn) => {
      if (btn.getAttribute("data-tab") === tab) {
        btn.classList.add("lockin-tab-active");
      } else {
        btn.classList.remove("lockin-tab-active");
      }
    });

    // Show/hide sections
    if (tab === "chat") {
      this.chatContainerElement.style.display = "";
      this.notesElement.style.display = "none";
    } else {
      this.chatContainerElement.style.display = "none";
      this.notesElement.style.display = "";
      // Close history panel when switching to notes
      this.closeHistoryPanel();
      // Dispatch event to load notes
      window.dispatchEvent(
        new CustomEvent("lockin:loadNotes", { detail: { tab } })
      );
    }
  }

  /**
   * Toggle chat history panel
   */
  handleHistoryToggle(e) {
    e.stopPropagation();
    if (this.isHistoryPanelOpen) {
      this.closeHistoryPanel();
    } else {
      this.openHistoryPanel();
    }
  }

  /**
   * Open chat history panel
   */
  openHistoryPanel() {
    if (this.activeTab !== "chat") return;
    this.isHistoryPanelOpen = true;
    if (this.chatHistoryPanelElement) {
      this.chatHistoryPanelElement.setAttribute("data-state", "open");
    }
  }

  /**
   * Close chat history panel
   */
  closeHistoryPanel() {
    this.isHistoryPanelOpen = false;
    if (this.chatHistoryPanelElement) {
      this.chatHistoryPanelElement.setAttribute("data-state", "closed");
    }
  }

  /**
   * Open the sidebar
   */
  open() {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.sidebarElement.setAttribute("data-state", "expanded");
    this.togglePill.setAttribute("aria-label", "Close Lock-in sidebar");

    // Apply margin to page on desktop
    this.adjustPageMargin();

    this.saveState();
    this.dispatchEvent("open");
  }

  /**
   * Close the sidebar
   */
  close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.sidebarElement.setAttribute("data-state", "collapsed");
    this.togglePill.setAttribute("aria-label", "Open Lock-in sidebar");

    // Remove margin from page
    this.removePageMargin();

    this.saveState();
    this.dispatchEvent("close");
  }

  /**
   * Toggle open/closed state
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Adjust page width when sidebar opens (desktop only)
   * Left side stays fixed at 60%, right side is the resizable sidebar
   */
  adjustPageMargin() {
    if (!this.isDesktopMode) {
      return; // No width adjustment on mobile
    }

    // Calculate what percentage the sidebar should be
    const viewportWidth = window.innerWidth;
    const sidebarPercentage = (
      (this.config.sidebarWidth / viewportWidth) *
      100
    ).toFixed(2);
    const contentPercentage = (100 - sidebarPercentage).toFixed(2);

    // Set page max-width to constrain it to 70%
    document.documentElement.style.setProperty(
      "--lockin-content-width",
      "70%",
      "important"
    );
    document.body.style.setProperty("max-width", "70%", "important");
  }

  /**
   * Remove page width constraints when sidebar closes
   */
  removePageMargin() {
    document.documentElement.style.removeProperty("--lockin-content-width");
    document.body.style.removeProperty("max-width");
  }

  /**
   * Update responsive mode based on viewport width
   */
  updateResponsiveMode() {
    this.isDesktopMode = window.innerWidth > 1024;
  }

  /**
   * Render sidebar content (called by contentScript)
   */
  renderContent(contentHtml) {
    // Render mode selector in chat header (next to history toggle button)
    const chatHeader = this.chatMainElement.querySelector(".lockin-chat-header");
    const modeWrapper = chatHeader?.querySelector(".lockin-mode-selector-wrapper");
    if (modeWrapper) {
      modeWrapper.innerHTML = contentHtml.modes || "";
    }

    // Render chat content in main chat area
    const chatContent = this.chatMainElement.querySelector(".lockin-chat-content");
    if (chatContent) {
      chatContent.innerHTML = contentHtml.chat || "";
    }

    // Render history in history panel
    if (this.chatHistoryPanelElement) {
      this.chatHistoryPanelElement.innerHTML = contentHtml.history || "";
    }

    // Render notes
    if (this.notesElement) {
      this.notesElement.innerHTML = contentHtml.notes || "";
    }

    // Update tab visibility
    if (this.activeTab === "chat") {
      this.chatContainerElement.style.display = "";
      this.notesElement.style.display = "none";
    } else {
      this.chatContainerElement.style.display = "none";
      this.notesElement.style.display = "";
    }

    // Re-attach event listeners to new elements
    this.attachContentEventListeners();
  }

  /**
   * Attach event listeners to dynamically rendered content
   */
  attachContentEventListeners() {
    // Mode options
    const modeOptions = this.sidebarElement.querySelectorAll(
      ".lockin-mode-option"
    );
    modeOptions.forEach((option) => {
      option.addEventListener("click", this.handleModeOptionClick);
    });

    // Mode pill (toggle expandable menu)
    const modePill = this.sidebarElement.querySelector(".lockin-mode-pill");
    if (modePill) {
      modePill.addEventListener("click", (e) => {
        e.stopPropagation();
        const expandable = this.sidebarElement.querySelector(
          ".lockin-mode-expandable"
        );
        if (expandable) {
          const isVisible = expandable.style.display !== "none";
          expandable.style.display = isVisible ? "none" : "flex";
        }
      });
    }

    // Chat send button
    const sendBtn = this.sidebarElement.querySelector(".lockin-send-btn");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("lockin:sendMessage"));
      });
    }

    // Chat input field
    const chatInput = this.sidebarElement.querySelector("#lockin-chat-input");
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (sendBtn) sendBtn.click();
        }
      });
    }

    // History items
    const historyItems = this.chatHistoryPanelElement.querySelectorAll(
      ".lockin-history-item"
    );
    historyItems.forEach((item) => {
      item.addEventListener("click", this.handleHistoryItemClick);
    });

    // History item menu buttons
    const historyMenus = this.chatHistoryPanelElement.querySelectorAll(
      ".lockin-history-item-menu"
    );
    historyMenus.forEach((menu) => {
      menu.addEventListener("click", (e) => {
        e.stopPropagation();
        const chatId = menu.getAttribute("data-chat-id");
        if (chatId) {
          window.dispatchEvent(
            new CustomEvent("lockin:deleteChat", { detail: { chatId } })
          );
        }
      });
    });

    // New chat button
    const newChatBtn = this.chatHistoryPanelElement.querySelector(
      ".lockin-new-chat-btn"
    );
    if (newChatBtn) {
      newChatBtn.addEventListener("click", this.handleNewChatClick);
    }

    // Tab buttons
    const tabButtons = this.topBarElement.querySelectorAll(".lockin-tab");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", this.handleTabClick);
    });
  }

  /**
   * Get the chat content container
   */
  getChatElement() {
    return this.chatMainElement;
  }

  /**
   * Get bubble element (alias for getChatElement for compatibility with LockinWidget)
   */
  getBubbleElement() {
    return this.chatMainElement;
  }

  /**
   * Get the sidebar element
   */
  getSidebarElement() {
    return this.sidebarElement;
  }

  /**
   * Get the root element
   */
  getRootElement() {
    return this.rootElement;
  }

  /**
   * Dispatch custom event
   */
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(`lockin:${eventName}`, { detail });
    window.dispatchEvent(event);
  }

  /**
   * Save state to storage
   */
  saveState() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({
        lockin_sidebar_isOpen: this.isOpen,
      });
    }
  }

  /**
   * Restore state from storage
   */
  restoreState() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.sync.get(["lockin_sidebar_isOpen"], (data) => {
          // Restore sidebar open state
          if (data.lockin_sidebar_isOpen !== undefined) {
            this.isOpen = data.lockin_sidebar_isOpen;
            if (this.sidebarElement) {
              this.sidebarElement.setAttribute(
                "data-state",
                this.isOpen ? "expanded" : "collapsed"
              );
            }
            if (this.isOpen) {
              this.adjustPageMargin();
            }
          }
        });
      } catch (error) {
        console.log("Lock-in Sidebar: Storage access error:", error);
      }
    }
  }

  /**
   * Destroy sidebar and clean up
   */
  destroy() {
    this.removePageMargin();
    if (this.rootElement) {
      this.rootElement.remove();
    }
    this.rootElement = null;
    this.togglePill = null;
    this.sidebarElement = null;
    this.topBarElement = null;
    this.chatContainerElement = null;
    this.chatHistoryPanelElement = null;
    this.chatMainElement = null;
    this.notesElement = null;
  }
}

// Export for use in contentScript
if (typeof window !== "undefined") {
  window.LockinSidebar = LockinSidebar;
}
