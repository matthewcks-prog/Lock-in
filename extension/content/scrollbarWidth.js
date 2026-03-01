/**
 * Scrollbar width detection and management module.
 * Provides utilities to detect browser scrollbar width and update CSS variables accordingly.
 * This ensures consistent layout calculations regardless of scrollbar presence.
 */

(function () {
  const CSS_VAR_SCROLLBAR_WIDTH = '--lockin-scrollbar-width';
  const CSS_VAR_CONTENT_WIDTH = '--lockin-content-width';
  const CSS_VAR_SIDEBAR_WIDTH = '--lockin-sidebar-width';
  const MEASURE_ELEMENT_ID = 'lockin-scrollbar-measure';
  const FALLBACK_LOGGER = { debug: () => {}, warn: console.warn, error: console.error };
  const DEBOUNCE_DELAY_MS = 50;

  /**
   * Measures the browser's scrollbar width by creating a temporary scrollable element.
   * @returns {number} Width of the scrollbar in pixels
   */
  function measureScrollbarWidth() {
    // Create temporary outer div with scrollbar
    const outer = document.createElement('div');
    outer.id = MEASURE_ELEMENT_ID;
    outer.style.cssText =
      'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;';

    // Create inner div to create scrollable content
    const inner = document.createElement('div');
    inner.style.width = '100%';
    inner.style.height = '200px'; // Make it scrollable
    outer.appendChild(inner);

    document.body.appendChild(outer);

    // Calculate scrollbar width: outer width - inner width
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

    // Clean up
    document.body.removeChild(outer);

    return scrollbarWidth;
  }

  /**
   * Detects if the body currently has a visible vertical scrollbar.
   * Returns false when overflow is hidden (e.g. fake fullscreen) even if
   * content is taller than the viewport, because no scrollbar is rendered.
   * @returns {boolean} True if a scrollbar is visually present
   */
  function hasVerticalScrollbar() {
    if (typeof document === 'undefined') {
      return false;
    }
    const body = document.body;
    const html = document.documentElement;

    // When overflow is hidden on body or html, no scrollbar is rendered.
    // This covers fake fullscreen (body.lockin-fake-fullscreen sets overflow:hidden).
    try {
      const bodyOverflow = window.getComputedStyle(body).overflowY;
      const htmlOverflow = window.getComputedStyle(html).overflowY;
      if (bodyOverflow === 'hidden' || htmlOverflow === 'hidden') {
        return false;
      }
    } catch {
      // getComputedStyle can throw in detached contexts; fall through
    }

    // Check if content height exceeds viewport height
    return (
      body.scrollHeight > window.innerHeight ||
      html.scrollHeight > window.innerHeight ||
      body.scrollHeight > body.clientHeight ||
      html.scrollHeight > html.clientHeight
    );
  }

  /**
   * Updates CSS custom properties for scrollbar width and content width calculations.
   *
   * Uses `var(--lockin-sidebar-width)` instead of a static snapshot so that
   * `--lockin-content-width` automatically tracks sidebar resize changes.
   *
   * With `scrollbar-gutter: stable` on body.lockin-sidebar-open, the browser
   * always reserves space for the scrollbar gutter. This means 100vw is
   * consistent regardless of scrollbar visibility, so we always subtract the
   * measured scrollbar width.
   *
   * @param {number} scrollbarWidth - The measured scrollbar width
   */
  function updateScrollbarCSSVars(scrollbarWidth) {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;

    // Set the measured scrollbar width
    root.style.setProperty(CSS_VAR_SCROLLBAR_WIDTH, `${scrollbarWidth}px`);

    // Always subtract scrollbar width — scrollbar-gutter:stable ensures the
    // gutter is reserved even when no scrollbar is rendered, keeping 100vw
    // consistent across page states.
    root.style.setProperty(
      CSS_VAR_CONTENT_WIDTH,
      `calc(100vw - var(${CSS_VAR_SIDEBAR_WIDTH}) - ${scrollbarWidth}px)`,
    );
  }

  /**
   * Recalculates and updates scrollbar-related CSS variables.
   * Should be called when scrollbar state might have changed.
   * @param {object} state - Module state containing logger
   */
  function recalculateScrollbarWidth(state) {
    try {
      const scrollbarWidth = measureScrollbarWidth();
      const hasScrollbar = hasVerticalScrollbar();

      state.currentScrollbarWidth = scrollbarWidth;
      state.hasScrollbar = hasScrollbar;

      updateScrollbarCSSVars(scrollbarWidth);

      state.logger.debug(
        `[ScrollbarWidth] Updated: ${scrollbarWidth}px, has scrollbar: ${hasScrollbar}`,
      );
    } catch (error) {
      state.logger.error('[ScrollbarWidth] Failed to recalculate:', error);
    }
  }

  /**
   * Handles body class changes that might affect scrollbar visibility.
   * @param {object} state - Module state
   * @param {MutationRecord[]} mutations - DOM mutations
   */
  function handleBodyMutations(state, mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        // Debounce recalculation to avoid excessive updates
        if (state.recalcTimeout) {
          clearTimeout(state.recalcTimeout);
        }
        state.recalcTimeout = setTimeout(() => {
          const newHasScrollbar = hasVerticalScrollbar();
          if (newHasScrollbar !== state.hasScrollbar) {
            recalculateScrollbarWidth(state);
          }
        }, DEBOUNCE_DELAY_MS);
        break;
      }
    }
  }

  /**
   * Initializes the scrollbar width manager.
   * Sets up observers and performs initial calculation.
   * @param {object} state - Manager state
   */
  function initManager(state) {
    if (state.initialized) {
      state.logger.warn('[ScrollbarWidth] Already initialized');
      return;
    }

    // Initial calculation
    recalculateScrollbarWidth(state);

    // Watch for body class changes (e.g., fake-fullscreen, sidebar-open)
    state.observer = new MutationObserver((mutations) => {
      handleBodyMutations(state, mutations);
    });

    state.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Watch for window resize
    state.resizeObserver = new ResizeObserver(() => {
      recalculateScrollbarWidth(state);
    });

    state.resizeObserver.observe(document.documentElement);

    state.initialized = true;
    state.logger.debug('[ScrollbarWidth] Initialized');
  }

  /**
   * Destroys the scrollbar width manager and cleans up resources.
   * @param {object} state - Manager state
   */
  function destroyManager(state) {
    if (!state.initialized) {
      return;
    }

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }

    if (state.recalcTimeout) {
      clearTimeout(state.recalcTimeout);
      state.recalcTimeout = null;
    }

    // Reset CSS variables
    const root = document.documentElement;
    root.style.removeProperty(CSS_VAR_SCROLLBAR_WIDTH);
    root.style.removeProperty(CSS_VAR_CONTENT_WIDTH);

    state.initialized = false;
    state.logger.debug('[ScrollbarWidth] Destroyed');
  }

  /**
   * Creates and initializes the scrollbar width manager.
   * @param {object} deps - Dependencies
   * @param {object} deps.Logger - Logger instance
   * @returns {object} Scrollbar manager instance
   */
  function createScrollbarWidthManager(deps) {
    const logger = deps && deps.Logger ? deps.Logger : FALLBACK_LOGGER;

    const state = {
      logger,
      currentScrollbarWidth: 0,
      hasScrollbar: false,
      observer: null,
      resizeObserver: null,
      recalcTimeout: null,
      initialized: false,
    };

    return {
      init: () => initManager(state),
      forceUpdate: () => recalculateScrollbarWidth(state),
      destroy: () => destroyManager(state),
      get scrollbarWidth() {
        return state.currentScrollbarWidth;
      },
      get hasScrollbar() {
        return state.hasScrollbar;
      },
    };
  }

  // Export to global namespace for content script consumption
  if (typeof window !== 'undefined') {
    window.LockInContent = window.LockInContent || {};
    window.LockInContent.createScrollbarWidthManager = createScrollbarWidthManager;
  }
})();
