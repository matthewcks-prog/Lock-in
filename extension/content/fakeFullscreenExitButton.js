/**
 * Exit button for fake fullscreen mode.
 *
 * Creates a floating "Exit fullscreen" button (upper-left) that lets users
 * leave the fake fullscreen view. The button fades in on hover or briefly
 * flashes on activation so the user knows it exists.
 */
(function () {
  const EXIT_BUTTON_ID = 'lockin-fake-fullscreen-exit';
  const EXIT_VISIBLE_CLASS = 'lockin-exit-visible';
  /** How long (ms) the exit button stays visible after appearing on activation. */
  const SHOW_DURATION_MS = 2500;

  /**
   * Builds an SVG "shrink" icon conveying "exit fullscreen".
   * @returns {SVGElement}
   */
  function createExitIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M4 14h6v6m0 0L4 14m16-4h-6V4m0 0l6 6');
    svg.appendChild(path);
    return svg;
  }

  /**
   * Creates the exit button, appends it to the body, and briefly flashes it.
   * @param {object} state  Fake-fullscreen module state (mutated: exitButton, exitVisibilityTimer)
   * @param {function} onExit  Callback invoked when the button is clicked
   */
  function createExitButton(state, onExit) {
    removeExitButton(state);

    const btn = document.createElement('button');
    btn.id = EXIT_BUTTON_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Exit fullscreen');
    btn.appendChild(createExitIcon());
    btn.appendChild(document.createTextNode('Exit fullscreen'));
    btn.addEventListener('click', onExit);

    // Brief flash so user discovers the control
    btn.classList.add(EXIT_VISIBLE_CLASS);
    state.exitVisibilityTimer = setTimeout(() => {
      btn.classList.remove(EXIT_VISIBLE_CLASS);
      state.exitVisibilityTimer = null;
    }, SHOW_DURATION_MS);

    document.body.appendChild(btn);
    state.exitButton = btn;
  }

  /** Removes the exit button from the DOM and clears timers. */
  function removeExitButton(state) {
    if (state.exitVisibilityTimer) {
      clearTimeout(state.exitVisibilityTimer);
      state.exitVisibilityTimer = null;
    }
    if (state.exitButton) {
      state.exitButton.remove();
      state.exitButton = null;
    }
    const stale = document.getElementById(EXIT_BUTTON_ID);
    if (stale) {
      stale.remove();
    }
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createExitButton = createExitButton;
  window.LockInContent.removeExitButton = removeExitButton;
})();
