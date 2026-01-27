/**
 * User interaction handlers (keyboard shortcuts).
 */
(function () {
  function createInteractionController({ stateStore, onCloseSidebar, logger }) {
    const log = logger || { debug: () => {} };

    function handleKeyPress(event) {
      if (event.key === 'Escape') {
        const target = event.target;
        if (
          target &&
          typeof target.closest === 'function' &&
          (target.closest('#lockin-sidebar') || target.closest('#lockin-root'))
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
      document.addEventListener('keydown', handleKeyPress);
      log.debug('Interaction handlers bound');

      return () => {
        document.removeEventListener('keydown', handleKeyPress);
      };
    }

    return { bind };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.createInteractionController = createInteractionController;
})();
