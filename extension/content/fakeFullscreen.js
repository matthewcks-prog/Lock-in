const BODY_CLASS = 'lockin-fake-fullscreen';
const VIDEO_CLASS = 'lockin-fake-fullscreen-video';
const SIDEBAR_OPEN_CLASS = 'lockin-sidebar-open';
const TOGGLE_ID = 'lockin-fake-fs-toggle';
const TOGGLE_VISIBLE_CLASS = 'lockin-fake-fs-toggle--visible';
const TOGGLE_COOLDOWN_MS = 200;
const FALLBACK_LOGGER = { debug: () => {}, warn: console.warn, error: console.error };

function captureInlineStyles(element) {
  const style = element.style;
  return {
    position: style.position,
    top: style.top,
    left: style.left,
    width: style.width,
    height: style.height,
    zIndex: style.zIndex,
    maxWidth: style.maxWidth,
    maxHeight: style.maxHeight,
    objectFit: style.objectFit,
    margin: style.margin,
    padding: style.padding,
    transform: style.transform,
  };
}

function restoreInlineStyles(element, savedStyles) {
  if (!element || !savedStyles) {
    return;
  }
  Object.keys(savedStyles).forEach((key) => {
    element.style[key] = savedStyles[key];
  });
}

function isVideoRelatedElement(element) {
  if (!element || typeof element.tagName !== 'string') {
    return false;
  }
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'video' || tagName === 'iframe') {
    return true;
  }
  return typeof element.querySelector === 'function' && element.querySelector('video') !== null;
}

function isSidebarOpen(state) {
  const store = state.stateStore;
  if (store && typeof store.getSnapshot === 'function') {
    const snapshot = store.getSnapshot();
    return snapshot && snapshot.isSidebarOpen === true;
  }
  return document.body.classList.contains(SIDEBAR_OPEN_CLASS);
}

function ensureToggleButton(state) {
  const existing = document.getElementById(TOGGLE_ID);
  if (existing) {
    return existing;
  }
  const button = document.createElement('button');
  button.id = TOGGLE_ID;
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', 'Exit fullscreen');
  button.textContent = 'Exit Fullscreen';
  button.addEventListener('click', () => {
    deactivate(state);
  });
  document.body.appendChild(button);
  return button;
}

function showToggleButton(state) {
  ensureToggleButton(state).classList.add(TOGGLE_VISIBLE_CLASS);
}

function hideToggleButton() {
  const button = document.getElementById(TOGGLE_ID);
  if (button) {
    button.classList.remove(TOGGLE_VISIBLE_CLASS);
  }
}

function removeToggleButton() {
  const button = document.getElementById(TOGGLE_ID);
  if (button) {
    button.remove();
  }
}

function canToggle(state, timestamp) {
  return state.lastToggleAt === 0 || timestamp - state.lastToggleAt >= TOGGLE_COOLDOWN_MS;
}

function activate(state, element) {
  if (!element || state.active) {
    return false;
  }
  const now = Date.now();
  if (!canToggle(state, now)) {
    return false;
  }
  state.lastToggleAt = now;
  state.savedStyles = captureInlineStyles(element);
  state.activeElement = element;
  element.classList.add(VIDEO_CLASS);
  document.body.classList.add(BODY_CLASS);
  if (isSidebarOpen(state)) {
    showToggleButton(state);
  }
  state.active = true;
  state.logger.debug('[FakeFullscreen] Activated');
  return true;
}

function deactivate(state) {
  if (!state.active) {
    return false;
  }
  state.active = false;
  state.lastToggleAt = Date.now();
  if (state.activeElement) {
    state.activeElement.classList.remove(VIDEO_CLASS);
    restoreInlineStyles(state.activeElement, state.savedStyles);
  }
  document.body.classList.remove(BODY_CLASS);
  hideToggleButton();
  state.activeElement = null;
  state.savedStyles = null;
  state.logger.debug('[FakeFullscreen] Deactivated');
  return true;
}

function resolveFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function resolveExitFullscreen() {
  if (typeof document.exitFullscreen === 'function') {
    return () => document.exitFullscreen();
  }
  if (typeof document.webkitExitFullscreen === 'function') {
    return () => document.webkitExitFullscreen();
  }
  return null;
}

function handleNativeFullscreenChange(state) {
  if (state.interceptingNativeExit || state.active) {
    return;
  }
  const fullscreenElement = resolveFullscreenElement();
  if (!isVideoRelatedElement(fullscreenElement)) {
    return;
  }
  const exitFullscreen = resolveExitFullscreen();
  if (!exitFullscreen) {
    activate(state, fullscreenElement);
    return;
  }
  state.interceptingNativeExit = true;
  exitFullscreen()
    .catch(() => undefined)
    .finally(() => {
      activate(state, fullscreenElement);
      state.interceptingNativeExit = false;
    });
}

function createPatchedRequestFullscreen(state, nativeRequest) {
  return function patchedRequestFullscreen(...args) {
    if (isVideoRelatedElement(this)) {
      activate(state, this);
      return Promise.resolve();
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
  if (event.key !== 'Escape' || !state.active) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  deactivate(state);
}

function handleSidebarStateChange(state, snapshot) {
  if (!state.active) {
    return;
  }
  if (snapshot && snapshot.isSidebarOpen === true) {
    showToggleButton(state);
    return;
  }
  hideToggleButton();
}

function subscribeToSidebarState(state) {
  const store = state.stateStore;
  if (!store || typeof store.subscribe !== 'function') {
    return;
  }
  state.unsubscribeStateStore = store.subscribe((snapshot) => {
    handleSidebarStateChange(state, snapshot);
  });
}

function init(state) {
  if (state.initialized) {
    return;
  }
  patchFullscreenApis(state);
  state.keydownHandler = (event) => {
    handleEscapeKey(state, event);
  };
  state.fullscreenChangeHandler = () => {
    handleNativeFullscreenChange(state);
  };
  document.addEventListener('keydown', state.keydownHandler, true);
  document.addEventListener('fullscreenchange', state.fullscreenChangeHandler);
  subscribeToSidebarState(state);
  state.initialized = true;
  state.logger.debug('[FakeFullscreen] Initialized');
}

function destroy(state) {
  deactivate(state);
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
  removeToggleButton();
  state.initialized = false;
}

function createFakeFullscreen(deps) {
  const logger = deps && deps.Logger ? deps.Logger : FALLBACK_LOGGER;
  const stateStore = deps && deps.stateStore ? deps.stateStore : null;
  const state = {
    logger,
    stateStore,
    active: false,
    activeElement: null,
    savedStyles: null,
    lastToggleAt: 0,
    initialized: false,
    interceptingNativeExit: false,
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
