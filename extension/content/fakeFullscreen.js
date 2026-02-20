/**
 * Fake fullscreen module - intercepts fullscreen requests when sidebar is open.
 */
/* eslint-disable max-statements */
(function () {
  const BODY_CLASS = 'lockin-fake-fullscreen';
  const VIDEO_CLASS = 'lockin-fake-fullscreen-video';
  const SIDEBAR_OPEN_CLASS = 'lockin-sidebar-open';
  const ACTIVATION_COOLDOWN_MS = 200;
  const FALLBACK_LOGGER = { debug: () => {}, warn: console.warn, error: console.error };

  const content = typeof window !== 'undefined' ? window.LockInContent || {} : {};
  const helperApi = content.fakeFullscreenHelpers || {};
  const captureInlineStyles = helperApi.captureInlineStyles || (() => null);
  const restoreInlineStyles = helperApi.restoreInlineStyles || (() => {});
  const isVideoRelatedElement =
    helperApi.isVideoRelatedElement ||
    ((element) => {
      if (!element || typeof element.tagName !== 'string') return false;
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'video' || tagName === 'iframe') return true;
      return typeof element.querySelector === 'function' && element.querySelector('video') !== null;
    });
  const resolveExitButtonHelpers =
    helperApi.resolveExitButtonHelpers ||
    ((explicitHelpers) =>
      explicitHelpers || {
        create: () => {},
        remove: () => {},
      });
  const updateScrollbarWidth = helperApi.updateScrollbarWidth || (() => {});

  function getExitButtonHelpers(state) {
    return resolveExitButtonHelpers(state.exitButtonHelpers);
  }

  function isSidebarOpen(state) {
    const store = state.stateStore;
    if (store && typeof store.getSnapshot === 'function') {
      const snapshot = store.getSnapshot();
      return snapshot && snapshot.isSidebarOpen === true;
    }
    return document.body.classList.contains(SIDEBAR_OPEN_CLASS);
  }

  function activate(state, element) {
    if (!element || state.active) return false;
    const now = Date.now();
    if (state.lastToggleAt !== 0 && now - state.lastToggleAt < ACTIVATION_COOLDOWN_MS) {
      return false;
    }

    state.lastToggleAt = now;
    state.savedStyles = captureInlineStyles(element);
    state.activeElement = element;
    element.classList.add(VIDEO_CLASS);
    document.body.classList.add(BODY_CLASS);
    state.active = true;

    state.logger.debug('[FakeFullscreen] Activated');
    updateScrollbarWidth(state.scrollbarManager);
    getExitButtonHelpers(state).create(state, () => deactivate(state));
    return true;
  }

  function deactivate(state) {
    if (!state.active) return false;

    state.active = false;
    state.lastToggleAt = Date.now();

    if (state.activeElement) {
      state.activeElement.classList.remove(VIDEO_CLASS);
      restoreInlineStyles(state.activeElement, state.savedStyles);
    }

    document.body.classList.remove(BODY_CLASS);
    state.activeElement = null;
    state.savedStyles = null;

    state.logger.debug('[FakeFullscreen] Deactivated');
    updateScrollbarWidth(state.scrollbarManager);
    getExitButtonHelpers(state).remove(state);
    return true;
  }

  function transitionToNativeFullscreen(state) {
    const element = state.activeElement;
    if (!element) {
      deactivate(state);
      return;
    }

    deactivate(state);

    const nativeReq = state.originalRequestFullscreen || state.originalWebkitRequestFullscreen;
    if (!nativeReq) {
      state.logger.warn('[FakeFullscreen] No native API for transition');
      return;
    }

    state.transitioningToNative = true;
    let didEnterNativeFullscreen = false;

    Promise.resolve(nativeReq.call(element))
      .then(() => {
        didEnterNativeFullscreen = true;
      })
      .catch((error) => {
        state.logger.warn('[FakeFullscreen] Native fullscreen transition failed', error);
      })
      .finally(() => {
        state.transitioningToNative = false;
        if (state.initialized && didEnterNativeFullscreen) {
          state.inNativeFullscreen = true;
        }
      });
  }

  function handleNativeFullscreenChange(state) {
    if (state.interceptingNativeExit || state.active || state.transitioningToNative) {
      return;
    }

    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement || null;

    if (state.inNativeFullscreen && !fullscreenElement) {
      state.inNativeFullscreen = false;
      getExitButtonHelpers(state).remove(state);
      state.logger.debug('[FakeFullscreen] Native fullscreen exited after transition');
      return;
    }

    if (!isSidebarOpen(state) || !isVideoRelatedElement(fullscreenElement)) {
      return;
    }

    const exitFn =
      typeof document.exitFullscreen === 'function'
        ? document.exitFullscreen.bind(document)
        : typeof document.webkitExitFullscreen === 'function'
          ? document.webkitExitFullscreen.bind(document)
          : null;

    if (!exitFn) {
      activate(state, fullscreenElement);
      return;
    }

    state.interceptingNativeExit = true;
    exitFn()
      .catch(() => undefined)
      .finally(() => {
        activate(state, fullscreenElement);
        state.interceptingNativeExit = false;
      });
  }

  function createPatchedRequestFullscreen(state, nativeRequest) {
    return function patchedRequestFullscreen(...args) {
      if (isVideoRelatedElement(this) && isSidebarOpen(state)) {
        if (state.active) {
          return Promise.resolve();
        }
        if (activate(state, this)) {
          return Promise.resolve();
        }
        state.logger.warn('[FakeFullscreen] Activation throttled, falling back to native API');
      }
      return nativeRequest.apply(this, args);
    };
  }

  function patchFullscreenApis(state) {
    if (typeof Element === 'undefined' || !Element.prototype) {
      return;
    }

    const nativeRequest =
      Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen;
    if (!nativeRequest) {
      return;
    }

    state.hadOwnRequestFullscreen = Object.prototype.hasOwnProperty.call(
      Element.prototype,
      'requestFullscreen',
    );
    state.hadOwnWebkitRequestFullscreen = Object.prototype.hasOwnProperty.call(
      Element.prototype,
      'webkitRequestFullscreen',
    );
    state.originalRequestFullscreen = Element.prototype.requestFullscreen;
    state.originalWebkitRequestFullscreen = Element.prototype.webkitRequestFullscreen;

    const patchedRequest = createPatchedRequestFullscreen(state, nativeRequest);
    Element.prototype.requestFullscreen = patchedRequest;
    if (typeof Element.prototype.webkitRequestFullscreen === 'function') {
      Element.prototype.webkitRequestFullscreen = patchedRequest;
    }
  }

  function unpatchFullscreenApis(state) {
    if (typeof Element === 'undefined' || !Element.prototype) {
      return;
    }

    if (state.hadOwnRequestFullscreen) {
      Element.prototype.requestFullscreen = state.originalRequestFullscreen;
    } else {
      delete Element.prototype.requestFullscreen;
    }

    if (state.hadOwnWebkitRequestFullscreen) {
      Element.prototype.webkitRequestFullscreen = state.originalWebkitRequestFullscreen;
    } else {
      delete Element.prototype.webkitRequestFullscreen;
    }

    state.hadOwnRequestFullscreen = false;
    state.hadOwnWebkitRequestFullscreen = false;
    state.originalRequestFullscreen = null;
    state.originalWebkitRequestFullscreen = null;
  }

  function handleEscapeKey(state, event) {
    if (event.key !== 'Escape' || !state.active) return;
    event.preventDefault();
    event.stopPropagation();
    deactivate(state);
  }

  function handleSidebarStateChange(state, snapshot) {
    if (!state.active) return;

    const sidebarOpen =
      snapshot && typeof snapshot.isSidebarOpen === 'boolean'
        ? snapshot.isSidebarOpen
        : isSidebarOpen(state);

    if (!sidebarOpen) {
      transitionToNativeFullscreen(state);
    }
  }

  function subscribeToSidebarState(state) {
    const store = state.stateStore;
    if (!store || typeof store.subscribe !== 'function') return;
    state.unsubscribeStateStore = store.subscribe((snapshot) =>
      handleSidebarStateChange(state, snapshot),
    );
  }

  function init(state) {
    if (state.initialized) return;
    patchFullscreenApis(state);
    state.keydownHandler = (event) => handleEscapeKey(state, event);
    state.fullscreenChangeHandler = () => handleNativeFullscreenChange(state);
    document.addEventListener('keydown', state.keydownHandler, true);
    document.addEventListener('fullscreenchange', state.fullscreenChangeHandler);
    subscribeToSidebarState(state);
    state.initialized = true;
    state.logger.debug('[FakeFullscreen] Initialized');
  }

  function destroy(state) {
    deactivate(state);
    getExitButtonHelpers(state).remove(state);
    unpatchFullscreenApis(state);

    if (state.keydownHandler) {
      document.removeEventListener('keydown', state.keydownHandler, true);
      state.keydownHandler = null;
    }

    if (state.fullscreenChangeHandler) {
      document.removeEventListener('fullscreenchange', state.fullscreenChangeHandler);
      state.fullscreenChangeHandler = null;
    }

    if (state.unsubscribeStateStore) {
      state.unsubscribeStateStore();
      state.unsubscribeStateStore = null;
    }

    state.interceptingNativeExit = false;
    state.transitioningToNative = false;
    state.inNativeFullscreen = false;
    state.initialized = false;
  }

  function createFakeFullscreen(deps) {
    const logger = deps && deps.Logger ? deps.Logger : FALLBACK_LOGGER;
    const stateStore = deps && deps.stateStore ? deps.stateStore : null;

    const state = {
      logger,
      stateStore,
      scrollbarManager: deps && deps.scrollbarManager ? deps.scrollbarManager : null,
      exitButtonHelpers:
        deps && deps.exitButtonHelpers && typeof deps.exitButtonHelpers === 'object'
          ? deps.exitButtonHelpers
          : null,
      active: false,
      activeElement: null,
      savedStyles: null,
      lastToggleAt: 0,
      initialized: false,
      interceptingNativeExit: false,
      transitioningToNative: false,
      inNativeFullscreen: false,
      exitButton: null,
      exitVisibilityTimer: null,
      hadOwnRequestFullscreen: false,
      hadOwnWebkitRequestFullscreen: false,
      originalRequestFullscreen: null,
      originalWebkitRequestFullscreen: null,
      keydownHandler: null,
      fullscreenChangeHandler: null,
      unsubscribeStateStore: null,
    };

    return {
      init: () => init(state),
      destroy: () => destroy(state),
      activate: (element) => activate(state, element),
      deactivate: () => deactivate(state),
      isActive: () => state.active,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createFakeFullscreen = createFakeFullscreen;
})();
