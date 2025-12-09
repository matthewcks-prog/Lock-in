/**
 * React sidebar host. Responsible for mounting/updating the UI bundle and
 * syncing body layout classes when the sidebar opens/closes.
 */
(function () {
  function createSidebarHost({ Logger, Storage }) {
    const log = Logger || { debug: () => {}, warn: console.warn, error: console.error };
    let sidebarInstance = null;
    let layoutTransitionTimeout = null;

    function injectStyles() {
      log.debug("Styles verification: CSS should be loaded from manifest");
    }

    function syncBodySplitState(open) {
      const body = document.body;
      const html = document.documentElement;
      if (!body || !html) return;

      if (open) {
        body.classList.add("lockin-sidebar-open");
        html.classList.add("lockin-sidebar-transitioning");
      } else {
        body.classList.remove("lockin-sidebar-open");
      }

      if (layoutTransitionTimeout) {
        clearTimeout(layoutTransitionTimeout);
      }
      layoutTransitionTimeout = setTimeout(() => {
        html.classList.remove("lockin-sidebar-transitioning");
      }, 320);
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
      };
    }

    function renderSidebar({ apiClient, adapter, pageContext, state, onToggle }) {
      if (!window.LockInUI || !window.LockInUI.createLockInSidebar) {
        log.error("LockInUI.createLockInSidebar not available");
        return;
      }

      const viewState = state || {};
      injectStyles();
      syncBodySplitState(!!viewState.isSidebarOpen);

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
      syncBodySplitState(!!state.isSidebarOpen);
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
      syncBodySplitState,
    };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createSidebarHost = createSidebarHost;
})();
