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
    this.isHistoryExpanded = false; // History sidebar expanded state

    // DOM elements
    this.rootElement = null;
    this.togglePill = null;
    this.sidebarElement = null;
    this.modesElement = null;
    this.chatElement = null;
    this.historyElement = null;

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

    // Modes section (with minimize button integrated)
    this.modesElement = document.createElement("section");
    this.modesElement.className = "lockin-sidebar-modes";
    this.modesElement.innerHTML = `
      <button class="lockin-minimize-btn" aria-label="Close sidebar" type="button">&#10005;</button>
    `;

    // Tabs section
    this.tabsElement = document.createElement("section");
    this.tabsElement.className = "lockin-tabs";
    this.tabsElement.innerHTML = `
      <button class="lockin-tab is-active" data-tab="chat" type="button">Chat</button>
      <button class="lockin-tab" data-tab="notes" type="button">Notes</button>
    `;

    // Tab panels container
    this.tabPanelsElement = document.createElement("div");
    this.tabPanelsElement.className = "lockin-tabpanels";

    // Chat panel with history sidebar
    this.chatPanel = document.createElement("div");
    this.chatPanel.className = "lockin-tabpanel is-active";
    this.chatPanel.setAttribute("data-tab-panel", "chat");
    
    // Chat layout container (for history + chat side by side)
    this.chatLayout = document.createElement("div");
    this.chatLayout.className = "lockin-chat-layout";
    
    // History sidebar (left side, collapsible)
    this.historySidebar = document.createElement("div");
    this.historySidebar.className = "lockin-history-sidebar";
    this.historySidebar.setAttribute("data-state", "collapsed");
    
    // History toggle button (3 vertical dashes)
    this.historyToggle = document.createElement("button");
    this.historyToggle.className = "lockin-history-toggle-btn";
    this.historyToggle.type = "button";
    this.historyToggle.setAttribute("aria-label", "Toggle chat history");
    this.historyToggle.innerHTML = '<span class="lockin-history-toggle-icon">⋮</span>';
    this.historyToggle.addEventListener("click", () => this.toggleHistorySidebar());
    
    // History content container
    this.historyElement = document.createElement("div");
    this.historyElement.className = "lockin-sidebar-history";
    
    this.historySidebar.appendChild(this.historyToggle);
    this.historySidebar.appendChild(this.historyElement);
    
    // Chat content (right side)
    this.chatElement = document.createElement("div");
    this.chatElement.className = "lockin-sidebar-chat";
    
    // Append to layout
    this.chatLayout.appendChild(this.historySidebar);
    this.chatLayout.appendChild(this.chatElement);
    this.chatPanel.appendChild(this.chatLayout);

    // Notes panel
    this.notesPanel = document.createElement("div");
    this.notesPanel.className = "lockin-tabpanel";
    this.notesPanel.setAttribute("data-tab-panel", "notes");
    this.notesElement = document.createElement("div");
    this.notesElement.className = "lockin-sidebar-notes";
    this.notesPanel.appendChild(this.notesElement);

    // Append panels to container
    this.tabPanelsElement.appendChild(this.chatPanel);
    this.tabPanelsElement.appendChild(this.notesPanel);

    // Append to sidebar
    this.sidebarElement.appendChild(this.modesElement);
    this.sidebarElement.appendChild(this.tabsElement);
    this.sidebarElement.appendChild(this.tabPanelsElement);

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

    // Minimize button click
    const minimizeBtn = this.modesElement.querySelector(
      ".lockin-minimize-btn"
    );
    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", this.handleMinimizeClick);
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
    const tabButtons = this.tabsElement.querySelectorAll(".lockin-tab");
    tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("is-active", isActive);
    });

    // Update tab panels
    const tabPanels = this.tabPanelsElement.querySelectorAll(".lockin-tabpanel");
    tabPanels.forEach((panel) => {
      const isActive = panel.getAttribute("data-tab-panel") === tab;
      panel.classList.toggle("is-active", isActive);
    });

    // Dispatch event to load notes if switching to notes tab
    if (tab === "notes") {
      window.dispatchEvent(
        new CustomEvent("lockin:loadNotes", { detail: { tab, filter: "page" } })
      );
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
    // contentHtml should contain the modes, chat, notes, and history sections
    this.modesElement.innerHTML = contentHtml.modes || "";
    this.chatElement.innerHTML = contentHtml.chat || "";
    this.notesElement.innerHTML = contentHtml.notes || "";
    this.historyElement.innerHTML = contentHtml.history || "";

    // Tab visibility is handled by CSS classes, but ensure correct state
    this.switchTab(this.activeTab);

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

    // Chat textarea
    const textarea = this.sidebarElement.querySelector(".lockin-chat-textarea");
    if (textarea) {
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (sendBtn) sendBtn.click();
        }
      });
    }

    // History items
    const historyItems = this.sidebarElement.querySelectorAll(
      ".lockin-history-item"
    );
    historyItems.forEach((item) => {
      item.addEventListener("click", this.handleHistoryItemClick);
    });

    // History item menu buttons
    const historyMenus = this.sidebarElement.querySelectorAll(
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
    const newChatBtn = this.sidebarElement.querySelector(
      ".lockin-new-chat-btn"
    );
    if (newChatBtn) {
      newChatBtn.addEventListener("click", this.handleNewChatClick);
    }

    // Tab buttons - use initTabs for proper tab switching
    this.initTabs();
  }

  /**
   * Initialize tab switching logic
   */
  initTabs() {
    const tabButtons = this.tabsElement.querySelectorAll(".lockin-tab");
    const tabPanels = this.tabPanelsElement.querySelectorAll(".lockin-tabpanel");

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        this.switchTab(target);
      });
    });
  }

  /**
   * Get the chat content container
   */
  getChatElement() {
    return this.chatElement;
  }

  /**
   * Get bubble element (alias for getChatElement for compatibility with LockinWidget)
   */
  getBubbleElement() {
    return this.chatElement;
  }

  /**
   * Toggle history sidebar expand/collapse
   */
  toggleHistorySidebar() {
    this.isHistoryExpanded = !this.isHistoryExpanded;
    if (this.historySidebar) {
      this.historySidebar.setAttribute(
        "data-state",
        this.isHistoryExpanded ? "expanded" : "collapsed"
      );
    }
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
    this.modesElement = null;
    this.chatElement = null;
    this.chatLayout = null;
    this.historySidebar = null;
    this.historyToggle = null;
    this.historyElement = null;
  }
}

// Export for use in contentScript
if (typeof window !== "undefined") {
  window.LockinSidebar = LockinSidebar;
}
