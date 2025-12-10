/**
 * User interaction handlers (selection + keyboard shortcuts).
 */
(function () {
  function validateSelection(minLength) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { valid: false };
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < minLength) {
      return { valid: false };
    }

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

    return {
      valid: true,
      text: selectedText,
      rect: range.getBoundingClientRect(),
    };
  }

  function createInteractionController({
    stateStore,
    onRunMode,
    onCloseSidebar,
    determineMode,
    logger,
    minSelectionLength = 3,
  }) {
    const log = logger || { debug: () => {} };
    const isMac = navigator.platform.toUpperCase().includes("MAC");

    function handleMouseUp(event) {
      const state = stateStore.getSnapshot();
      if (!state.highlightingEnabled) return;

      const hasModifierKey = isMac ? event.metaKey : event.ctrlKey;
      if (!hasModifierKey) return;

      setTimeout(async () => {
        const validationResult = validateSelection(minSelectionLength);
        if (!validationResult.valid) return;

        stateStore.setSelection(validationResult.text);
        const mode = (await determineMode()) || stateStore.getSnapshot().currentMode;
        await onRunMode(mode);
      }, 50);
    }

    function handleKeyPress(event) {
      if (event.key === "Escape") {
        const target = event.target;
        if (
          target &&
          typeof target.closest === "function" &&
          (target.closest("#lockin-sidebar") || target.closest("#lockin-root"))
        ) {
          return;
        }
        const state = stateStore.getSnapshot();
        if (state.isSidebarOpen && onCloseSidebar) {
          onCloseSidebar();
        }
      }
    }

    function bind() {
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("keydown", handleKeyPress);
      log.debug("Interaction handlers bound");

      return () => {
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("keydown", handleKeyPress);
      };
    }

    return { bind };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createInteractionController = createInteractionController;
})();
