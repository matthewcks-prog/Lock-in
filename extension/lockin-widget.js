/**
 * Lock-in Widget System
 *
 * Manages the pill + bubble widget as a unified draggable component.
 * Features:
 * - Pill (collapsed) to Bubble (expanded) smooth animation
 * - Intelligent orientation (expands up or down based on screen position)
 * - Unified dragging for pill + bubble
 * - State persistence (position, size, open/closed) across pages
 * - Auto-open on text selection
 * - Resizable bubble with handles + auto-collapse on tiny sizes
 */

// Layout + sizing constants to avoid magic numbers
const LOCKIN_WIDGET_TOP_OFFSET = 24; // px from top of viewport
const LOCKIN_WIDGET_SIDE_OFFSET = 24; // px from right when using default position
const LOCKIN_WIDGET_MIN_MARGIN = 16; // safe margin from viewport edges

const LOCKIN_BUBBLE_DEFAULT_WIDTH = 420;
const LOCKIN_BUBBLE_DEFAULT_HEIGHT = 480;

const LOCKIN_BUBBLE_MIN_WIDTH = 360;
const LOCKIN_BUBBLE_MIN_HEIGHT = 420;

// Threshold below which we auto-collapse back to pill-only view.
// This is kept close to the min size so users can still shrink the bubble
// comfortably without accidental collapses.
const LOCKIN_BUBBLE_COLLAPSE_THRESHOLD_WIDTH = LOCKIN_BUBBLE_MIN_WIDTH * 0.75;
const LOCKIN_BUBBLE_COLLAPSE_THRESHOLD_HEIGHT = LOCKIN_BUBBLE_MIN_HEIGHT * 0.75;

class LockinWidget {
  constructor(options = {}) {
    // Configuration
    this.config = {
      minMargin: LOCKIN_WIDGET_MIN_MARGIN,
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
    this.isResizing = false;
    this.hasCustomPosition = false;
    this.position = {
      top: LOCKIN_WIDGET_TOP_OFFSET,
      right: LOCKIN_WIDGET_SIDE_OFFSET,
    };
    this.size = {
      width: options.defaultWidth || LOCKIN_BUBBLE_DEFAULT_WIDTH,
      height: options.defaultHeight || LOCKIN_BUBBLE_DEFAULT_HEIGHT,
    };
    this.bubbleContent = null; // Will hold the chat UI (inner container)
    this.lastDragTime = 0;

    // DOM elements
    this.rootElement = null;
    this.pillButton = null;
    this.bubbleElement = null; // outer shell (sized + constrained)

    // Bind methods
    this.handlePillClick = this.handlePillClick.bind(this);
    this.handlePillMouseDown = this.handlePillMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleTextSelection = this.handleTextSelection.bind(this);
    this.handleResizeMove = this.handleResizeMove.bind(this);
    this.handleResizeEnd = this.handleResizeEnd.bind(this);
  }

  /**
   * Initialize the widget on page load
   */
  init() {
    console.log("Lock-in: Initializing widget");
    this.createDOM();
    console.log("Lock-in: DOM created, rootElement:", this.rootElement?.id);
    this.restoreState();
    this.attachEventListeners();
    this.updateOrientation();
    console.log("Lock-in: Widget initialized, isOpen:", this.isOpen);
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
    console.log(
      "Lock-in: Root element created with classes:",
      this.rootElement.className
    );

    // Pill button
    this.pillButton = document.createElement("button");
    this.pillButton.id = "lockin-pill";
    this.pillButton.type = "button";
    this.pillButton.className = "lockin-pill";
    this.pillButton.setAttribute("aria-label", "Toggle Lock-in chat");
    this.pillButton.setAttribute("aria-pressed", "false");
    // Add inline styles to ensure visibility
    this.pillButton.style.display = "inline-flex";
    this.pillButton.style.alignItems = "center";
    this.pillButton.innerHTML = `
      <span class="lockin-pill-icon">🔒</span>
      <span class="lockin-pill-text">Lock-in</span>
      <span class="lockin-pill-status"></span>
    `;
    console.log(
      "Lock-in: Pill button created, innerHTML:",
      this.pillButton.innerHTML
    );

    // Bubble outer shell container (sized + constrained)
    this.bubbleElement = document.createElement("div");
    this.bubbleElement.id = "lockin-bubble";
    this.bubbleElement.className = "lockin-bubble";
    this.bubbleElement.setAttribute("role", "dialog");
    this.bubbleElement.setAttribute("aria-label", "Lock-in Chat Assistant");

    // Inner content container that the content script writes into.
    // This ensures resize handles remain intact around the bubble.
    this.bubbleContent = document.createElement("div");
    this.bubbleContent.className = "lockin-bubble-inner";
    this.bubbleElement.appendChild(this.bubbleContent);

    // Apply default size
    this.applySize();

    // Add resize handles for smooth, edge/corner-based resizing
    const directions = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    directions.forEach((dir) => {
      const handle = document.createElement("div");
      handle.className = `lockin-resize-handle lockin-resize-${dir}`;
      // Support mouse + touch interactions
      const startResizeForEvent = (event) => this.startResize(dir, event);
      handle.addEventListener("mousedown", startResizeForEvent);
      handle.addEventListener("touchstart", startResizeForEvent, {
        passive: false,
      });
      this.bubbleElement.appendChild(handle);
    });

    // Append to root
    this.rootElement.appendChild(this.pillButton);
    this.rootElement.appendChild(this.bubbleElement);
    console.log(
      "Lock-in: Elements appended to root. Pill button in DOM:",
      this.rootElement.contains(this.pillButton)
    );

    // Append widget to body - ensure body exists
    if (document.body) {
      document.body.appendChild(this.rootElement);
      console.log("Lock-in: Widget appended to document.body");
    } else {
      // Fallback: append to documentElement if body not ready
      document.documentElement.appendChild(this.rootElement);
      console.log("Lock-in: Widget appended to document.documentElement");
    }

    // Apply position
    this.applyPosition();
    console.log(
      "Lock-in: Position applied. Widget style top:",
      this.rootElement.style.top,
      "right:",
      this.rootElement.style.right
    );
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
    // Ensure we have a concrete starting position based on the current
    // on‑screen location of the widget, not just the last stored values.
    // This guarantees smooth dragging even if the widget was initially
    // positioned via CSS (top/right) instead of explicit left/top values.
    if (this.rootElement) {
      const rect = this.rootElement.getBoundingClientRect();
      const margin = this.config.minMargin;

      // If left/top haven't been initialised yet, derive them from the
      // current bounding rect so that dragging works from anywhere.
      if (typeof this.position.left !== "number") {
        this.position.left = Math.max(margin, rect.left);
      }
      if (typeof this.position.top !== "number") {
        this.position.top = Math.max(margin, rect.top);
      }

      // Clear right/bottom anchors so the widget is solely controlled
      // by left/top while dragging across the screen.
      delete this.position.right;
      delete this.position.bottom;

      this.applyPosition();
    }

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
    this.clampWithinViewport();
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
    // User explicitly moved the widget – treat this as a custom position
    this.hasCustomPosition = true;
    this.clampWithinViewport();
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
    this.bubbleElement.classList.add("lockin-visible");
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
    this.bubbleElement.classList.remove("lockin-visible");
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

    // Always expand the bubble downward regardless of vertical position
    this.rootElement.classList.remove("lockin-orient-up");
    this.rootElement.classList.add("lockin-orient-down");
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
    this.clampWithinViewport();
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

    // Support either left- or right-anchored positioning so that the
    // widget can default to the top-right corner but still be dragged
    // freely across the screen.
    if (typeof this.position.left === "number") {
      this.rootElement.style.left = `${this.position.left}px`;
      this.rootElement.style.right = "auto";
    } else if (typeof this.position.right === "number") {
      this.rootElement.style.right = `${this.position.right}px`;
      this.rootElement.style.left = "auto";
    } else {
      // Fallback to top-right if neither side is set
      this.rootElement.style.right = `${LOCKIN_WIDGET_SIDE_OFFSET}px`;
      this.rootElement.style.left = "auto";
    }

    this.rootElement.style.zIndex = "999999";
  }

  /**
   * Ensure the entire widget / bubble stays within the viewport.
   * Uses the bubble element when available so no part of the chat UI
   * can extend past the window edges (left, right, top, or bottom).
   */
  clampWithinViewport() {
    if (!this.rootElement) {
      return;
    }

    const margin = this.config.minMargin;
    const targetRect =
      this.bubbleElement?.getBoundingClientRect() ||
      this.rootElement.getBoundingClientRect();

    let offsetX = 0;
    let offsetY = 0;

    if (targetRect.left < margin) {
      offsetX = margin - targetRect.left;
    } else if (targetRect.right > window.innerWidth - margin) {
      offsetX = window.innerWidth - margin - targetRect.right;
    }

    if (targetRect.top < margin) {
      offsetY = margin - targetRect.top;
    } else if (targetRect.bottom > window.innerHeight - margin) {
      offsetY = window.innerHeight - margin - targetRect.bottom;
    }

    if (offsetX !== 0 || offsetY !== 0) {
      if (typeof this.position.left === "number") {
        this.position.left += offsetX;
      }
      if (typeof this.position.top === "number") {
        this.position.top += offsetY;
      }
      delete this.position.right;
      delete this.position.bottom;
      this.applyPosition();
    }
  }

  /**
   * Apply current size to the bubble element
   */
  applySize() {
    if (!this.bubbleElement) {
      return;
    }

    this.bubbleElement.style.width = `${this.size.width}px`;
    this.bubbleElement.style.height = `${this.size.height}px`;
  }

  /**
   * Start resizing from a given edge/corner
   */
  startResize(direction, e) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.bubbleElement || !this.rootElement) {
      return;
    }

    const point =
      e.touches && e.touches[0]
        ? e.touches[0]
        : e.changedTouches && e.changedTouches[0]
        ? e.changedTouches[0]
        : e;

    this.isResizing = true;
    this.resizeDirection = direction;
    this.resizeStartX = point.clientX;
    this.resizeStartY = point.clientY;

    const bubbleRect = this.bubbleElement.getBoundingClientRect();
    const rootRect = this.rootElement.getBoundingClientRect();

    this.startWidth = bubbleRect.width;
    this.startHeight = bubbleRect.height;

    // Base position for north/west edges when resizing
    this.dragStartTop =
      typeof this.position.top === "number" ? this.position.top : rootRect.top;
    this.dragStartLeft =
      typeof this.position.left === "number"
        ? this.position.left
        : rootRect.left;

    document.addEventListener("mousemove", this.handleResizeMove);
    document.addEventListener("mouseup", this.handleResizeEnd);
  }

  /**
   * Handle mouse move while resizing
   */
  handleResizeMove(e) {
    if (!this.isResizing || !this.bubbleElement) {
      return;
    }

    const point =
      e.touches && e.touches[0]
        ? e.touches[0]
        : e.changedTouches && e.changedTouches[0]
        ? e.changedTouches[0]
        : e;

    const dx = point.clientX - this.resizeStartX;
    const dy = point.clientY - this.resizeStartY;
    const margin = this.config.minMargin;

    let newWidth = this.startWidth;
    let newHeight = this.startHeight;
    let newTop = this.dragStartTop;
    let newLeft = this.dragStartLeft;

    const dir = this.resizeDirection;

    if (dir.includes("e")) {
      newWidth = this.startWidth + dx;
    }
    if (dir.includes("s")) {
      newHeight = this.startHeight + dy;
    }
    if (dir.includes("w")) {
      newWidth = this.startWidth - dx;
      newLeft = this.dragStartLeft + dx;
    }
    if (dir.includes("n")) {
      newHeight = this.startHeight - dy;
      newTop = this.dragStartTop + dy;
    }

    // Clamp size to viewport with sensible minimums
    const minWidth = LOCKIN_BUBBLE_MIN_WIDTH;
    const minHeight = LOCKIN_BUBBLE_MIN_HEIGHT;
    const maxWidth = window.innerWidth - margin * 2;
    const maxHeight = window.innerHeight - margin * 2;

    // If the user drags the bubble below the collapse threshold,
    // automatically collapse back to pill-only view and reset size
    // to the configured minimum for the next open.
    if (
      newWidth < LOCKIN_BUBBLE_COLLAPSE_THRESHOLD_WIDTH ||
      newHeight < LOCKIN_BUBBLE_COLLAPSE_THRESHOLD_HEIGHT
    ) {
      this.autoCollapseFromResize();
      return;
    }

    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

    // Clamp position when resizing from north/west
    const rootRect = this.rootElement.getBoundingClientRect();
    const maxTop = window.innerHeight - rootRect.height - margin;
    const maxLeft = window.innerWidth - rootRect.width - margin;

    newTop = Math.max(margin, Math.min(newTop, maxTop));
    newLeft = Math.max(margin, Math.min(newLeft, maxLeft));

    this.size.width = newWidth;
    this.size.height = newHeight;
    this.applySize();

    if (dir.includes("n") || dir.includes("w")) {
      this.position.top = newTop;
      this.position.left = newLeft;
      delete this.position.right;
      delete this.position.bottom;
      this.applyPosition();
      this.updateOrientation();
    }

    // After any resize, ensure the bubble stays fully within the viewport.
    this.clampWithinViewport();
  }

  /**
   * Finish resizing
   */
  handleResizeEnd() {
    if (!this.isResizing) {
      return;
    }

    this.isResizing = false;
    document.removeEventListener("mousemove", this.handleResizeMove);
    document.removeEventListener("mouseup", this.handleResizeEnd);
    document.removeEventListener("touchmove", this.handleResizeMove);
    document.removeEventListener("touchend", this.handleResizeEnd);
    this.clampWithinViewport();
    // Resizes that adjust the north/west edges also move the widget;
    // consider that a custom position for future restores.
    this.hasCustomPosition = true;
    this.saveState();
  }

  /**
   * Auto-collapse the bubble when resized below the minimum useful size.
   * Hides the bubble, shows only the pill, and resets size to the minimum
   * so the next open starts from a sensible layout.
   */
  autoCollapseFromResize() {
    this.isResizing = false;
    document.removeEventListener("mousemove", this.handleResizeMove);
    document.removeEventListener("mouseup", this.handleResizeEnd);
    document.removeEventListener("touchmove", this.handleResizeMove);
    document.removeEventListener("touchend", this.handleResizeEnd);

    // Reset bubble size to minimum for next open
    this.size.width = LOCKIN_BUBBLE_MIN_WIDTH;
    this.size.height = LOCKIN_BUBBLE_MIN_HEIGHT;
    this.applySize();

    // Close the bubble (shows only the pill)
    this.close();
    this.saveState();
  }

  /**
   * Set bubble content
   */
  setBubbleContent(htmlContent) {
    if (this.bubbleContent) {
      this.bubbleContent.innerHTML = htmlContent;
    }
  }

  /**
   * Get bubble element for external manipulation
   */
  getBubbleElement() {
    // Expose only the inner content container so that callers (contentScript)
    // can render freely without destroying the resize handles.
    return this.bubbleContent || this.bubbleElement;
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
        [`${this.config.storagePrefix}hasCustomPosition`]:
          this.hasCustomPosition,
        [`${this.config.storagePrefix}position`]: {
          top: this.position.top,
          left: this.position.left,
        },
        [`${this.config.storagePrefix}size`]: this.size,
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
            `${this.config.storagePrefix}hasCustomPosition`,
            `${this.config.storagePrefix}position`,
            `${this.config.storagePrefix}size`,
          ],
          (data) => {
            if (data[`${this.config.storagePrefix}isOpen`] !== undefined) {
              this.isOpen = data[`${this.config.storagePrefix}isOpen`];
            }
            if (
              data[`${this.config.storagePrefix}hasCustomPosition`] !==
              undefined
            ) {
              this.hasCustomPosition =
                data[`${this.config.storagePrefix}hasCustomPosition`];
            }
            if (
              this.hasCustomPosition &&
              data[`${this.config.storagePrefix}position`]
            ) {
              this.position = data[`${this.config.storagePrefix}position`];
            }
            if (data[`${this.config.storagePrefix}size`]) {
              this.size = data[`${this.config.storagePrefix}size`];
            }

            // Once state is restored, re-apply to the DOM so that
            // position + size stay consistent across navigation.
            if (this.rootElement) {
              this.applyPosition();
              // Apply the open/closed class state to match the restored isOpen flag
              if (this.isOpen) {
                this.rootElement.classList.remove("lockin-closed");
                this.rootElement.classList.add("lockin-open");
              } else {
                this.rootElement.classList.add("lockin-closed");
                this.rootElement.classList.remove("lockin-open");
              }
            }
            if (this.bubbleElement) {
              this.applySize();
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
