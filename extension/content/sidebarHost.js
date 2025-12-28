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
    const PAGE_WRAPPER_ID = "lockin-page-wrapper";
    const LOCKIN_ROOT_ID = "lockin-root";
    const WRAPPER_SKIP_TAGS = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "LINK",
      "META",
    ]);
    let sidebarInstance = null;
    let pageObserver = null;

    function injectStyles() {
      log.debug("Styles verification: CSS should be loaded from manifest");
    }

    function shouldMoveNode(node, wrapper, lockinRoot) {
      if (!node) return false;
      if (node === wrapper || node === lockinRoot) return false;
      if (node.nodeType === Node.COMMENT_NODE) return false;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName || "";
        if (WRAPPER_SKIP_TAGS.has(tag)) return false;
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
      if (!wrapper || pageObserver || typeof MutationObserver === "undefined") {
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
      if (typeof document === "undefined") return null;
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

      wrapper = document.createElement("div");
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
          if (!Storage) return null;
          try {
            const data = await Storage.get(key);
            return data[key];
          } catch (error) {
            log.warn("Storage get error:", error);
            return null;
          }
        },
        set: async (key, value) => {
          if (!Storage) return;
          try {
            await Storage.set({ [key]: value });
          } catch (error) {
            log.warn("Storage set error:", error);
          }
        },
        getLocal: async (key) => {
          if (!Storage || !Storage.getLocal) return null;
          try {
            const data = await Storage.getLocal(key);
            return data[key];
          } catch (error) {
            log.warn("Storage getLocal error:", error);
            return null;
          }
        },
        setLocal: async (key, value) => {
          if (!Storage || !Storage.setLocal) return;
          try {
            await Storage.setLocal(key, value);
          } catch (error) {
            log.warn("Storage setLocal error:", error);
          }
        },
      };
    }

    function renderSidebar({
      apiClient,
      adapter,
      pageContext,
      state,
      onToggle,
    }) {
      if (!window.LockInUI || !window.LockInUI.createLockInSidebar) {
        log.error("LockInUI.createLockInSidebar not available");
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
        selectedText: viewState.cachedSelection,
        pageContext,
        adapter,
        storage: buildStorageAdapter(),
        activeTabExternal: viewState.currentActiveTab,
      };

      if (!sidebarInstance) {
        log.debug("Creating new sidebar instance (first time)");
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
        selectedText: state.cachedSelection,
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
