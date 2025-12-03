/**
 * Lock-in Widget System
 *
 * Manages the pill + bubble widget as a unified draggable component.
 * Features:
 * - Pill (collapsed) to Bubble (expanded) smooth animation
 * - Intelligent orientation (expands up or down based on screen position)
 * - Unified dragging for pill + bubble
 * - State persistence
 * - Auto-open on text selection
 */

class LockinWidget {
  constructor(options = {}) {
    // Configuration
    this.config = {
      minMargin: 8,
      dragThrottle: 16, // ~60fps
      expandDuration: 220,
      collapseDuration: 180,
      autoOpenOnSelection: options.autoOpenOnSelection !== false,
      storagePrefix: "lockin_",
      ...options,
    };

    // State
    this.isOpen = false;
    this.isDragging = false;
    this.position = { top: 16, right: 16 };
    this.bubbleContent = null; // Will hold the chat UI
    this.lastDragTime = 0;

    // DOM elements
    this.rootElement = null;
    this.pillButton = null;
    this.bubbleElement = null;

    // Bind methods
    this.handlePillClick = this.handlePillClick.bind(this);
    this.handlePillMouseDown = this.handlePillMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleTextSelection = this.handleTextSelection.bind(this);
  }

  /**
   * Initialize the widget on page load
   */
  init() {
    this.restoreState();
    this.createDOM();
    this.attachEventListeners();
    this.updateOrientation();

    // Apply initial state
    if (this.isOpen) {
      this.rootElement.classList.add("lockin-open");
      this.rootElement.classList.remove("lockin-closed");
    } else {
      this.rootElement.classList.add("lockin-closed");
      this.rootElement.classList.remove("lockin-open");
    }
  }

  /**
   * Create the DOM structure for widget
   */
  createDOM() {
    // Remove existing widget if present
    const existing = document.getElementById("lockin-widget");
    if (existing) {
      existing.remove();
    }

    // Root widget container
    this.rootElement = document.createElement("div");
    this.rootElement.id = "lockin-widget";
    this.rootElement.className = "lockin-closed lockin-orient-down";

    // Pill button
    this.pillButton = document.createElement("button");
    this.pillButton.id = "lockin-pill";
    this.pillButton.type = "button";
    this.pillButton.className = "lockin-pill";
    this.pillButton.setAttribute("aria-label", "Toggle Lock-in chat");
    this.pillButton.setAttribute("aria-pressed", "false");
    this.pillButton.innerHTML = `
      <span class="lockin-pill-icon">🔒</span>
      <span class="lockin-pill-text">Lock-in</span>
      <span class="lockin-pill-status"></span>
    `;

    // Bubble container
    this.bubbleElement = document.createElement("div");
    this.bubbleElement.id = "lockin-bubble";
    this.bubbleElement.className = "lockin-bubble";
    this.bubbleElement.setAttribute("role", "dialog");
    this.bubbleElement.setAttribute("aria-label", "Lock-in Chat Assistant");

    // Append to root
    this.rootElement.appendChild(this.pillButton);
    this.rootElement.appendChild(this.bubbleElement);

    // Append widget to body
    document.body.appendChild(this.rootElement);

    // Apply position
    this.applyPosition();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Pill click to toggle
    this.pillButton.addEventListener("click", this.handlePillClick);

    // Pill drag start
    this.pillButton.addEventListener("mousedown", this.handlePillMouseDown);

    // Window resize to update orientation
    window.addEventListener("resize", this.handleWindowResize);

    // Text selection to auto-open
    if (this.config.autoOpenOnSelection) {
      document.addEventListener("mouseup", this.handleTextSelection);
      document.addEventListener("keyup", this.handleTextSelection);
    }
  }

  /**
   * Remove event listeners
   */
  removeEventListeners() {
    this.pillButton.removeEventListener("click", this.handlePillClick);
    this.pillButton.removeEventListener("mousedown", this.handlePillMouseDown);
    window.removeEventListener("resize", this.handleWindowResize);
    document.removeEventListener("mouseup", this.handleTextSelection);
    document.removeEventListener("keyup", this.handleTextSelection);
  }

  /**
   * Handle pill button click
   */
  handlePillClick(e) {
    e.stopPropagation();

    // Don't toggle if dragging
    if (this.isDragging) {
      return;
    }

    this.toggle();
  }

  /**
   * Handle pill mouse down (start drag)
   */
  handlePillMouseDown(e) {
    e.stopPropagation();

    // Only drag on middle or left click
    if (e.button !== 0 && e.button !== 1) {
      return;
    }

    this.startDrag(e);
  }

  /**
   * Start dragging the widget
   */
  startDrag(e) {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartTop = this.position.top;
    this.dragStartLeft = this.position.left;

    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);

    this.rootElement.classList.add("lockin-dragging");
  }

  /**
   * Handle mouse move while dragging
   */
  handleMouseMove(e) {
    const now = Date.now();
    if (now - this.lastDragTime < this.config.dragThrottle) {
      return;
    }
    this.lastDragTime = now;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    let newTop = this.dragStartTop + deltaY;
    let newLeft = this.dragStartLeft + deltaX;

    // Clamp to viewport with margin
    const rect = this.rootElement.getBoundingClientRect();
    const margin = this.config.minMargin;

    newTop = Math.max(
      margin,
      Math.min(newTop, window.innerHeight - rect.height - margin)
    );
    newLeft = Math.max(
      margin,
      Math.min(newLeft, window.innerWidth - rect.width - margin)
    );

    this.position.top = newTop;
    this.position.left = newLeft;
    delete this.position.right;
    delete this.position.bottom;

    this.applyPosition();
    this.updateOrientation();
  }

  /**
   * Handle mouse up (end drag)
   */
  handleMouseUp(e) {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);

    this.rootElement.classList.remove("lockin-dragging");
    this.saveState();
  }

  /**
   * Handle window resize
   */
  handleWindowResize() {
    this.updateOrientation();
    this.clampPosition();
  }

  /**
   * Handle text selection auto-open
   */
  handleTextSelection() {
    const selection = window.getSelection().toString().trim();
    if (selection.length > 3 && !this.isOpen) {
      // Dispatch custom event that contentScript can listen to
      window.dispatchEvent(
        new CustomEvent("lockin:textSelected", { detail: { text: selection } })
      );
    }
  }

  /**
   * Toggle open/closed state with animation
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Open the bubble
   */
  open() {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.rootElement.classList.remove("lockin-closed");
    this.rootElement.classList.add("lockin-open");
    this.pillButton.setAttribute("aria-pressed", "true");

    this.saveState();
    this.dispatchEvent("open");
  }

  /**
   * Close the bubble
   */
  close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.rootElement.classList.add("lockin-closed");
    this.rootElement.classList.remove("lockin-open");
    this.pillButton.setAttribute("aria-pressed", "false");

    this.saveState();
    this.dispatchEvent("close");
  }

  /**
   * Update bubble orientation based on position
   */
  updateOrientation() {
    if (!this.rootElement) {
      return;
    }

    const rect = this.rootElement.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const viewportHalf = window.innerHeight / 2;

    if (centerY <= viewportHalf) {
      // Top half: expand downward
      this.rootElement.classList.remove("lockin-orient-up");
      this.rootElement.classList.add("lockin-orient-down");
    } else {
      // Bottom half: expand upward
      this.rootElement.classList.remove("lockin-orient-down");
      this.rootElement.classList.add("lockin-orient-up");
    }
  }

  /**
   * Clamp position to viewport
   */
  clampPosition() {
    if (!this.rootElement) {
      return;
    }

    const rect = this.rootElement.getBoundingClientRect();
    const margin = this.config.minMargin;

    this.position.top = Math.max(
      margin,
      Math.min(this.position.top, window.innerHeight - rect.height - margin)
    );
    this.position.left = Math.max(
      margin,
      Math.min(this.position.left, window.innerWidth - rect.width - margin)
    );

    this.applyPosition();
  }

  /**
   * Apply position to DOM
   */
  applyPosition() {
    if (!this.rootElement) {
      return;
    }

    this.rootElement.style.position = "fixed";
    this.rootElement.style.top = `${this.position.top}px`;
    this.rootElement.style.left = `${this.position.left}px`;
    this.rootElement.style.zIndex = "999999";
  }

  /**
   * Set bubble content
   */
  setBubbleContent(htmlContent) {
    if (this.bubbleElement) {
      this.bubbleElement.innerHTML = htmlContent;
    }
  }

  /**
   * Get bubble element for external manipulation
   */
  getBubbleElement() {
    return this.bubbleElement;
  }

  /**
   * Get pill element
   */
  getPillElement() {
    return this.pillButton;
  }

  /**
   * Get root widget element
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
        [`${this.config.storagePrefix}isOpen`]: this.isOpen,
        [`${this.config.storagePrefix}position`]: {
          top: this.position.top,
          left: this.position.left,
        },
      });
    }
  }

  /**
   * Restore state from storage
   */
  restoreState() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.sync.get(
          [
            `${this.config.storagePrefix}isOpen`,
            `${this.config.storagePrefix}position`,
          ],
          (data) => {
            if (data[`${this.config.storagePrefix}isOpen`] !== undefined) {
              this.isOpen = data[`${this.config.storagePrefix}isOpen`];
            }
            if (data[`${this.config.storagePrefix}position`]) {
              this.position = data[`${this.config.storagePrefix}position`];
            }
          }
        );
      } catch (error) {
        console.log("Lock-in: Storage access error:", error);
      }
    }
  }

  /**
   * Destroy widget and clean up
   */
  destroy() {
    this.removeEventListeners();
    if (this.rootElement) {
      this.rootElement.remove();
    }
    this.rootElement = null;
    this.pillButton = null;
    this.bubbleElement = null;
  }
}

// Export for use in contentScript
if (typeof window !== "undefined") {
  window.LockinWidget = LockinWidget;
}
