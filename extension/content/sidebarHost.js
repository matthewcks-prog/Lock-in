/**
 * React sidebar host. Responsible for mounting/updating the UI bundle.
 * Layout sync (body classes) is handled by the React component itself.
 */
(function () {
  function createSidebarHost({ Logger, Storage }) {
    const log = Logger || {
      debug: () => {},
      warn: console.warn,
      error: console.error,
    };
    const PAGE_WRAPPER_ID = 'lockin-page-wrapper';
    const LOCKIN_ROOT_ID = 'lockin-root';
    const WRAPPER_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META']);
    let sidebarInstance = null;
    let pageObserver = null;
    const runtimeStorage =
      typeof window !== 'undefined' && window.LockInContent && window.LockInContent.storage
        ? window.LockInContent.storage
        : Storage;

    function injectStyles() {
      log.debug('Styles verification: CSS should be loaded from manifest');
    }

    function shouldMoveNode(node, wrapper, lockinRoot) {
      if (!node) return false;
      if (node === wrapper || node === lockinRoot) return false;
      if (node.nodeType === Node.COMMENT_NODE) return false;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName || '';
        if (WRAPPER_SKIP_TAGS.has(tag)) return false;
        // Don't move fixed/absolute positioned elements - they're likely modals/popups
        // that need to stay as direct body children for correct stacking behavior
        try {
          const style = window.getComputedStyle(node);
          const position = style.getPropertyValue('position');
          if (position === 'fixed' || position === 'absolute') {
            return false;
          }
          // Don't move elements with very high z-index (likely overlays)
          const zIndex = parseInt(style.getPropertyValue('z-index'), 10);
          if (!isNaN(zIndex) && zIndex > 1000) {
            return false;
          }
        } catch (e) {
          // getComputedStyle might fail on some elements, just skip the check
        }
      }
      return true;
    }

    function moveNodeIntoWrapper(node, wrapper) {
      if (!wrapper || !node) return;
      if (node.nextSibling === wrapper && wrapper.firstChild) {
        wrapper.insertBefore(node, wrapper.firstChild);
        return;
      }
      wrapper.appendChild(node);
    }

    function startPageWrapperObserver(wrapper) {
      if (!wrapper || pageObserver || typeof MutationObserver === 'undefined') {
        return;
      }
      const body = document.body;
      if (!body) return;

      pageObserver = new MutationObserver((mutations) => {
        const currentWrapper = document.getElementById(PAGE_WRAPPER_ID);
        if (!currentWrapper) {
          pageObserver.disconnect();
          pageObserver = null;
          ensurePageWrapper();
          return;
        }

        const lockinRoot = document.getElementById(LOCKIN_ROOT_ID);
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.parentNode !== body) return;
            if (!shouldMoveNode(node, currentWrapper, lockinRoot)) return;
            moveNodeIntoWrapper(node, currentWrapper);
          });
        });
      });

      pageObserver.observe(body, { childList: true });
    }

    function ensurePageWrapper() {
      if (typeof document === 'undefined') return null;
      const body = document.body;
      if (!body) return null;

      let wrapper = document.getElementById(PAGE_WRAPPER_ID);
      const lockinRoot = document.getElementById(LOCKIN_ROOT_ID);
      if (wrapper) {
        if (lockinRoot && lockinRoot.parentNode === wrapper) {
          body.appendChild(lockinRoot);
        }
        if (lockinRoot && lockinRoot.parentNode === body) {
          body.insertBefore(wrapper, lockinRoot);
        }
        startPageWrapperObserver(wrapper);
        return wrapper;
      }

      wrapper = document.createElement('div');
      wrapper.id = PAGE_WRAPPER_ID;

      if (lockinRoot && lockinRoot.parentNode === body) {
        body.insertBefore(wrapper, lockinRoot);
      } else {
        body.appendChild(wrapper);
      }

      const nodesToMove = [];
      body.childNodes.forEach((node) => {
        if (!shouldMoveNode(node, wrapper, lockinRoot)) return;
        nodesToMove.push(node);
      });

      nodesToMove.forEach((node) => moveNodeIntoWrapper(node, wrapper));
      startPageWrapperObserver(wrapper);
      return wrapper;
    }

    function buildStorageAdapter() {
      return {
        get: async (key) => {
          if (!runtimeStorage) return null;
          try {
            const data = await runtimeStorage.get(key);
            return data[key];
          } catch (error) {
            log.warn('Storage get error:', error);
            return null;
          }
        },
        set: async (key, value) => {
          if (!runtimeStorage) return;
          try {
            await runtimeStorage.set({ [key]: value });
          } catch (error) {
            log.warn('Storage set error:', error);
          }
        },
        getLocal: async (key) => {
          if (!runtimeStorage || !runtimeStorage.getLocal) return null;
          try {
            const data = await runtimeStorage.getLocal(key);
            return data[key];
          } catch (error) {
            log.warn('Storage getLocal error:', error);
            return null;
          }
        },
        setLocal: async (key, value) => {
          if (!runtimeStorage || !runtimeStorage.setLocal) return;
          try {
            await runtimeStorage.setLocal(key, value);
          } catch (error) {
            log.warn('Storage setLocal error:', error);
          }
        },
      };
    }

    function renderSidebar({ apiClient, adapter, pageContext, state, onToggle, onClearPrefill }) {
      if (!window.LockInUI || !window.LockInUI.createLockInSidebar) {
        log.error('LockInUI.createLockInSidebar not available');
        return;
      }

      const viewState = state || {};
      injectStyles();
      ensurePageWrapper();

      const sidebarProps = {
        apiClient,
        isOpen: !!viewState.isSidebarOpen,
        onToggle,
        currentMode: viewState.currentMode,
        pendingPrefill: viewState.pendingPrefill,
        onClearPrefill,
        pageContext,
        adapter,
        storage: buildStorageAdapter(),
        activeTabExternal: viewState.currentActiveTab,
      };

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
        currentMode: state.currentMode,
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
