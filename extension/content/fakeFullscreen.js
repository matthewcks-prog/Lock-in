/**
 * Fake Fullscreen — Content Script
 *
 * Intercepts native fullscreen requests on video-related elements and
 * simulates fullscreen with CSS instead. When the sidebar is open the
 * video fills the content area beside it; when the sidebar is closed the
 * video fills the entire viewport and only the Lock-in toggle pill is
 * shown so the user can open the sidebar.
 *
 * A small floating "Exit Fullscreen" button is shown when the sidebar is
 * open. Pressing Escape also exits.
 *
 * Non-video elements (e.g. a presentation slide) are allowed to enter
 * native fullscreen normally.
 *
 * @module extension/content/fakeFullscreen
 */
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────
  var BODY_CLASS = 'lockin-fake-fullscreen';
  var VIDEO_CLASS = 'lockin-fake-fullscreen-video';
  var TOGGLE_ID = 'lockin-fake-fs-toggle';
  var MIN_TOGGLE_INTERVAL_MS = 200;

  // ── Pure helpers (stateless) ───────────────────────────────────────

  /** Save inline styles from an element for later restoration. */
  function captureStyles(el) {
    var s = el.style;
    return {
      position: s.position,
      top: s.top,
      left: s.left,
      width: s.width,
      height: s.height,
      zIndex: s.zIndex,
      maxWidth: s.maxWidth,
      maxHeight: s.maxHeight,
      objectFit: s.objectFit,
      margin: s.margin,
      padding: s.padding,
      transform: s.transform,
    };
  }

  /** Restore previously captured inline styles. */
  function restoreStyles(el, saved) {
    if (!el || !saved) return;
    Object.keys(saved).forEach(function (key) {
      el.style[key] = saved[key];
    });
  }

  /** Check whether an element is video-related (video, iframe, or container with a video). */
  function isVideoRelated(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'video') return true;
    if (tag === 'iframe') return true;
    if (el.querySelector && el.querySelector('video')) return true;
    return false;
  }

  // ── Factory ────────────────────────────────────────────────────────

  function createFakeFullscreen(deps) {
    var logger = (deps && deps.Logger) || {
      debug: function () {},
      warn: console.warn,
      error: console.error,
    };
    var stateStore = (deps && deps.stateStore) || null;

    // Instance state
    var active = false;
    var activeElement = null;
    var savedStylesRef = null;
    var lastToggleAt = 0;
    var origRequestFS = null;
    var origWebkitRequestFS = null;
    var keyHandler = null;
    var fsChangeHandler = null;
    var interceptingFullscreen = false;
    var unsubState = null;

    // ── Sidebar check ──────────────────────────────────────────────
    function isSidebarOpen() {
      if (stateStore) return stateStore.getSnapshot().isSidebarOpen;
      return document.body.classList.contains('lockin-sidebar-open');
    }

    // ── Throttle guard ─────────────────────────────────────────────
    function canToggle() {
      if (lastToggleAt === 0) return true;
      return Date.now() - lastToggleAt >= MIN_TOGGLE_INTERVAL_MS;
    }

    // ── Toggle button ──────────────────────────────────────────────
    function ensureToggleButton() {
      var btn = document.getElementById(TOGGLE_ID);
      if (btn) return btn;
      btn = document.createElement('button');
      btn.id = TOGGLE_ID;
      btn.setAttribute('aria-label', 'Exit fullscreen');
      btn.setAttribute('type', 'button');
      btn.textContent = 'Exit Fullscreen';
      btn.addEventListener('click', function () {
        deactivate();
      });
      document.body.appendChild(btn);
      return btn;
    }

    function showToggle() {
      var btn = ensureToggleButton();
      btn.classList.add('lockin-fake-fs-toggle--visible');
    }

    function hideToggle() {
      var btn = document.getElementById(TOGGLE_ID);
      if (btn) btn.classList.remove('lockin-fake-fs-toggle--visible');
    }

    // ── Activate / Deactivate ──────────────────────────────────────
    function activate(element) {
      if (active || !element) return false;
      if (!canToggle()) return false;

      lastToggleAt = Date.now();
      savedStylesRef = captureStyles(element);
      activeElement = element;

      element.classList.add(VIDEO_CLASS);
      document.body.classList.add(BODY_CLASS);

      // Only show the exit-fullscreen toggle when the sidebar is open;
      // when closed the Lock-in pill is the only visible control.
      if (isSidebarOpen()) {
        showToggle();
      }

      active = true;
      logger.debug(
        '[FakeFullscreen] Activated (sidebar ' + (isSidebarOpen() ? 'open' : 'closed') + ')',
      );
      return true;
    }

    function deactivate() {
      if (!active) return false;

      active = false;
      lastToggleAt = Date.now();

      if (activeElement) {
        activeElement.classList.remove(VIDEO_CLASS);
        restoreStyles(activeElement, savedStylesRef);
      }

      document.body.classList.remove(BODY_CLASS);
      hideToggle();

      activeElement = null;
      savedStylesRef = null;
      logger.debug('[FakeFullscreen] Deactivated');
      return true;
    }

    // ── Fullscreen interception ────────────────────────────────────
    function patchFullscreen() {
      if (typeof Element === 'undefined') return;
      origRequestFS =
        Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen;
      origWebkitRequestFS = Element.prototype.webkitRequestFullscreen || null;

      if (!origRequestFS) return;

      var patched = function requestFullscreen() {
        // Only intercept video-related elements; everything else goes native.
        if (isVideoRelated(this)) {
          activate(this);
          return Promise.resolve();
        }
        return origRequestFS.apply(this, arguments);
      };

      Element.prototype.requestFullscreen = patched;
      if (Element.prototype.webkitRequestFullscreen) {
        Element.prototype.webkitRequestFullscreen = patched;
      }
    }

    function unpatchFullscreen() {
      if (!origRequestFS) return;
      Element.prototype.requestFullscreen = origRequestFS;
      if (origWebkitRequestFS) {
        Element.prototype.webkitRequestFullscreen = origWebkitRequestFS;
      }
      origRequestFS = null;
      origWebkitRequestFS = null;
    }

    // ── Keyboard ───────────────────────────────────────────────────
    function onKeyDown(e) {
      if (!active) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        deactivate();
      }
    }

    // ── Fullscreen change listener (backup for iframes & edge cases) ──
    function onFullscreenChange() {
      // Skip events triggered by our own exitFullscreen() call
      if (interceptingFullscreen) return;

      var fsEl = document.fullscreenElement;

      // Real fullscreen entered for a video-related element → intercept it
      if (fsEl && isVideoRelated(fsEl) && !active) {
        var target = fsEl;
        interceptingFullscreen = true;

        var exitFn = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exitFn) {
          interceptingFullscreen = false;
          return;
        }

        exitFn
          .call(document)
          .then(function () {
            activate(target);
            interceptingFullscreen = false;
          })
          .catch(function () {
            // Still activate even if exitFullscreen rejects
            activate(target);
            interceptingFullscreen = false;
          });
      }
    }

    // ── Sidebar state subscription ─────────────────────────────────
    // Show/hide the exit-fullscreen toggle as the sidebar opens/closes
    // while fake fullscreen is active.
    function onSidebarStateChange(snapshot) {
      if (!active) return;
      if (snapshot.isSidebarOpen) {
        showToggle();
      } else {
        hideToggle();
      }
    }

    // ── Lifecycle ──────────────────────────────────────────────────
    function init() {
      patchFullscreen();
      keyHandler = onKeyDown;
      fsChangeHandler = onFullscreenChange;
      document.addEventListener('keydown', keyHandler, true);
      document.addEventListener('fullscreenchange', fsChangeHandler);

      // Subscribe to sidebar state changes so we can show/hide the
      // exit-fullscreen toggle dynamically.
      if (stateStore && stateStore.subscribe) {
        unsubState = stateStore.subscribe(onSidebarStateChange);
      }

      logger.debug('[FakeFullscreen] Initialized');
    }

    function destroy() {
      deactivate();
      unpatchFullscreen();
      if (keyHandler) {
        document.removeEventListener('keydown', keyHandler, true);
        keyHandler = null;
      }
      if (fsChangeHandler) {
        document.removeEventListener('fullscreenchange', fsChangeHandler);
        fsChangeHandler = null;
      }
      if (unsubState) {
        unsubState();
        unsubState = null;
      }
      var btn = document.getElementById(TOGGLE_ID);
      if (btn) btn.remove();
    }

    return {
      init: init,
      destroy: destroy,
      activate: activate,
      deactivate: deactivate,
      isActive: function () {
        return active;
      },
    };
  }

  // ── Export ──────────────────────────────────────────────────────────
  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createFakeFullscreen = createFakeFullscreen;
})();
