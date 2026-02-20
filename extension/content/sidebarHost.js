/**
 * React sidebar host. Responsible for mounting/updating the UI bundle.
 * Layout sync (body classes) is handled by the React component itself.
 */
/* eslint-disable max-statements -- Module IIFE requires multiple top-level declarations */
(function () {
  const PAGE_WRAPPER_ID = 'lockin-page-wrapper';
  const LOCKIN_ROOT_ID = 'lockin-root';
  const WRAPPER_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META']);

  function createDefaultLogger(Logger) {
    return (
      Logger || {
        debug: () => {},
        warn: console.warn,
        error: console.error,
      }
    );
  }

  function resolveRuntimeStorage(Storage) {
    const content = typeof window !== 'undefined' ? window.LockInContent : null;
    return content && content.storage ? content.storage : Storage;
  }

  function injectStyles(log) {
    log.debug('Styles verification: CSS should be loaded from manifest');
  }

  function isOverlayNode(node) {
    try {
      const style = window.getComputedStyle(node);
      const position = style.getPropertyValue('position');
      if (position === 'fixed' || position === 'absolute') {
        return true;
      }
      const zIndex = parseInt(style.getPropertyValue('z-index'), 10);
      return !isNaN(zIndex) && zIndex > 1000;
    } catch {
      return false;
    }
  }

  function shouldMoveNode(node, wrapper, lockinRoot) {
    if (!node) return false;
    if (node === wrapper || node === lockinRoot) return false;
    if (node.nodeType === Node.COMMENT_NODE) return false;
    if (node.nodeType !== Node.ELEMENT_NODE) return true;
    if (WRAPPER_SKIP_TAGS.has(node.tagName || '')) return false;
    return !isOverlayNode(node);
  }

  function moveNodeIntoWrapper(node, wrapper) {
    if (!wrapper || !node) return;
    if (node.nextSibling === wrapper && wrapper.firstChild) {
      wrapper.insertBefore(node, wrapper.firstChild);
      return;
    }
    wrapper.appendChild(node);
  }

  function withLockinRootOutsideWrapper(body, wrapper, lockinRoot) {
    if (!lockinRoot) return;
    if (lockinRoot.parentNode === wrapper) {
      body.appendChild(lockinRoot);
    }
    if (lockinRoot.parentNode === body) {
      body.insertBefore(wrapper, lockinRoot);
    }
  }

  function placeWrapperInBody(body, wrapper, lockinRoot) {
    if (lockinRoot && lockinRoot.parentNode === body) {
      body.insertBefore(wrapper, lockinRoot);
      return;
    }
    body.appendChild(wrapper);
  }

  function moveBodyChildrenIntoWrapper(body, wrapper, lockinRoot) {
    const nodesToMove = [];
    body.childNodes.forEach((node) => {
      if (shouldMoveNode(node, wrapper, lockinRoot)) {
        nodesToMove.push(node);
      }
    });
    nodesToMove.forEach((node) => moveNodeIntoWrapper(node, wrapper));
  }

  function createBodyMutationHandler(observerState) {
    return (mutations) => {
      const body = document.body;
      if (!body) return;
      const wrapper = document.getElementById(PAGE_WRAPPER_ID);
      if (!wrapper) {
        observerState.pageObserver.disconnect();
        observerState.pageObserver = null;
        observerState.ensurePageWrapper();
        return;
      }
      const lockinRoot = document.getElementById(LOCKIN_ROOT_ID);
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.parentNode !== body) return;
          if (!shouldMoveNode(node, wrapper, lockinRoot)) return;
          moveNodeIntoWrapper(node, wrapper);
        });
      });
    };
  }

  function startPageWrapperObserver(wrapper, observerState) {
    if (!wrapper || observerState.pageObserver || typeof MutationObserver === 'undefined') {
      return;
    }
    const body = document.body;
    if (!body) return;
    observerState.pageObserver = new MutationObserver(createBodyMutationHandler(observerState));
    observerState.pageObserver.observe(body, { childList: true });
  }

  function createPageWrapperManager() {
    const observerState = { pageObserver: null, ensurePageWrapper: () => null };

    function ensurePageWrapper() {
      if (typeof document === 'undefined') return null;
      const body = document.body;
      if (!body) return null;

      const existingWrapper = document.getElementById(PAGE_WRAPPER_ID);
      const lockinRoot = document.getElementById(LOCKIN_ROOT_ID);
      if (existingWrapper) {
        withLockinRootOutsideWrapper(body, existingWrapper, lockinRoot);
        startPageWrapperObserver(existingWrapper, observerState);
        return existingWrapper;
      }

      const wrapper = document.createElement('div');
      wrapper.id = PAGE_WRAPPER_ID;
      placeWrapperInBody(body, wrapper, lockinRoot);
      moveBodyChildrenIntoWrapper(body, wrapper, lockinRoot);
      startPageWrapperObserver(wrapper, observerState);
      return wrapper;
    }

    observerState.ensurePageWrapper = ensurePageWrapper;
    return { ensurePageWrapper };
  }

  function createStorageAdapter(runtimeStorage, log) {
    const wrapStorageCall =
      (fn, fallback) =>
      async (...args) => {
        if (!runtimeStorage) return fallback;
        try {
          return await fn(...args);
        } catch (error) {
          log.warn('Storage error:', error);
          return fallback;
        }
      };

    return {
      get: wrapStorageCall(async (key) => {
        const data = await runtimeStorage.get(key);
        return data[key];
      }, null),
      set: wrapStorageCall(async (key, value) => {
        await runtimeStorage.set({ [key]: value });
      }, undefined),
      getLocal: wrapStorageCall(async (key) => {
        const data = await runtimeStorage.getLocal(key);
        return data[key];
      }, null),
      setLocal: wrapStorageCall(async (key, value) => {
        await runtimeStorage.setLocal(key, value);
      }, undefined),
    };
  }

  function buildSidebarProps({
    apiClient,
    pageContext,
    state,
    onToggle,
    onClearPrefill,
    runtimeStorage,
    log,
  }) {
    const viewState = state || {};
    return {
      apiClient,
      isOpen: !!viewState.isSidebarOpen,
      onToggle,
      pendingPrefill: viewState.pendingPrefill,
      onClearPrefill,
      pageContext,
      storage: createStorageAdapter(runtimeStorage, log),
      activeTabExternal: viewState.currentActiveTab,
    };
  }

  function ensureScrollbarManager(scrollbarManagerState, log) {
    if (scrollbarManagerState.instance) return;
    if (window.LockInContent && window.LockInContent.scrollbarManager) {
      scrollbarManagerState.instance = window.LockInContent.scrollbarManager;
      return;
    }
    if (!window.LockInContent || !window.LockInContent.createScrollbarWidthManager) {
      log.warn('ScrollbarWidthManager not available, layout may shift on scrollbar changes');
      return;
    }
    try {
      scrollbarManagerState.instance = window.LockInContent.createScrollbarWidthManager({
        Logger: log,
      });
      scrollbarManagerState.instance.init();
      window.LockInContent.scrollbarManager = scrollbarManagerState.instance;
    } catch (error) {
      log.error('Failed to initialize scrollbar width manager:', error);
    }
  }

  function createSidebarHost({ Logger, Storage }) {
    const log = createDefaultLogger(Logger);
    const runtimeStorage = resolveRuntimeStorage(Storage);
    const { ensurePageWrapper } = createPageWrapperManager();
    let sidebarInstance = null;
    const scrollbarManagerState = { instance: null };

    function renderSidebar({ apiClient, pageContext, state, onToggle, onClearPrefill }) {
      if (!window.LockInUI || !window.LockInUI.createLockInSidebar) {
        log.error('LockInUI.createLockInSidebar not available');
        return;
      }

      ensureScrollbarManager(scrollbarManagerState, log);
      injectStyles(log);
      ensurePageWrapper();
      const sidebarProps = buildSidebarProps({
        apiClient,
        pageContext,
        state,
        onToggle,
        onClearPrefill,
        runtimeStorage,
        log,
      });

      if (!sidebarInstance) {
        log.debug('Creating new sidebar instance (first time)');
        sidebarInstance = window.LockInUI.createLockInSidebar(sidebarProps);
      } else {
        sidebarInstance.updateProps(sidebarProps);
      }
    }

    function updatePropsFromState(state) {
      if (!sidebarInstance) return;
      sidebarInstance.updateProps({
        isOpen: !!state.isSidebarOpen,
        pendingPrefill: state.pendingPrefill,
        activeTabExternal: state.currentActiveTab,
      });
    }

    return {
      renderSidebar,
      updatePropsFromState,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createSidebarHost = createSidebarHost;
})();
/* eslint-enable max-statements */
