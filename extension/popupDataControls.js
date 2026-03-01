(() => {
  const DOWNLOAD_ANCHOR_ID = 'lockin-export-download-anchor';
  const CLEAR_LOCAL_CONFIRM_TEXT =
    'Clear local Lock-in data on this device?\n\nThis removes browser-stored Lock-in data and signs you out locally. Cloud data is unchanged.';
  const DELETE_ACCOUNT_CONFIRM_TEXT =
    'Delete your Lock-in account and cloud data permanently?\n\nThis cannot be undone. Local browser data will also be cleared.';

  function toSafeErrorLog(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack ? '[stack omitted]' : undefined,
      };
    }
    if (typeof error === 'object' && error !== null) {
      const record = error;
      return {
        message:
          typeof record['message'] === 'string'
            ? record['message']
            : 'Unexpected popup data controls error object',
        code: record['code'],
      };
    }
    return { message: String(error) };
  }

  function createDownloadAnchor() {
    let anchor = document.getElementById(DOWNLOAD_ANCHOR_ID);
    if (anchor) return anchor;
    anchor = document.createElement('a');
    anchor.id = DOWNLOAD_ANCHOR_ID;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    return anchor;
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = createDownloadAnchor();
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  }

  function updateControls(state) {
    const deleteAvailable = state.repository.hasDeleteAccountPath();
    state.exportButton.disabled = state.isBusy;
    state.clearButton.disabled = state.isBusy;
    state.deleteButton.disabled = state.isBusy || !state.signedIn || !deleteAvailable;
    state.deleteButton.classList.toggle('hidden', !deleteAvailable);
    state.deleteFallback.classList.toggle('hidden', deleteAvailable);
  }

  async function runAction(state, action, fallbackErrorMessage) {
    if (state.isBusy) return;
    state.isBusy = true;
    updateControls(state);
    try {
      await action();
    } catch (error) {
      console.error('[Lock-in] Data controls action failed:', toSafeErrorLog(error));
      state.showStatus(error?.message || fallbackErrorMessage || 'Action failed.', 'error');
    } finally {
      state.isBusy = false;
      updateControls(state);
    }
  }

  function bindExportAction(state) {
    state.exportButton.addEventListener('click', () => {
      void runAction(
        state,
        async () => {
          const { payload, filename } = await state.repository.exportData();
          downloadJson(payload, filename);
          const cloudAvailable = payload?.data?.cloud?.available === true;
          state.showStatus(
            cloudAvailable ? 'Data export downloaded.' : 'Local-only export downloaded.',
            'success',
          );
        },
        'Failed to export data.',
      );
    });
  }

  function bindClearAction(state) {
    state.clearButton.addEventListener('click', () => {
      if (!window.confirm(CLEAR_LOCAL_CONFIRM_TEXT)) return;
      void runAction(
        state,
        async () => {
          await state.repository.clearLocalData();
          state.showStatus('Local data cleared. Cloud data was not changed.', 'success');
        },
        'Failed to clear local data.',
      );
    });
  }

  function bindDeleteAction(state, setSignedInState) {
    state.deleteButton.addEventListener('click', () => {
      if (!window.confirm(DELETE_ACCOUNT_CONFIRM_TEXT)) return;
      void runAction(
        state,
        async () => {
          await state.repository.deleteAccount();
          state.showStatus('Account deleted and local data cleared.', 'success');
          setSignedInState(false);
        },
        'Failed to delete account.',
      );
    });
  }

  function createDataControlsController(controllerOptions) {
    const state = {
      ...controllerOptions,
      isBusy: false,
      signedIn: false,
    };

    function setSignedInState(isSignedIn) {
      state.signedIn = isSignedIn === true;
      updateControls(state);
    }

    bindExportAction(state);
    bindClearAction(state);
    bindDeleteAction(state, setSignedInState);
    updateControls(state);
    return { setSignedInState };
  }

  function resolveControllerElements() {
    return {
      exportButton: document.getElementById('export-data-button'),
      clearButton: document.getElementById('clear-local-data-button'),
      deleteButton: document.getElementById('delete-account-button'),
      deleteFallback: document.getElementById('delete-account-fallback'),
    };
  }

  let controller = null;

  async function initDataControlsSection(options = {}) {
    const showStatus = typeof options.showStatus === 'function' ? options.showStatus : () => {};
    const { exportButton, clearButton, deleteButton, deleteFallback } = resolveControllerElements();
    const createDataRepository = window.LockInPopupDataRepository?.createDataRepository;

    if (
      !exportButton ||
      !clearButton ||
      !deleteButton ||
      !deleteFallback ||
      typeof createDataRepository !== 'function'
    ) {
      return;
    }

    const repository = createDataRepository({
      apiClient: window.LockInAPI,
      authClient: window.LockInAuth,
    });

    controller = createDataControlsController({
      showStatus,
      repository,
      exportButton,
      clearButton,
      deleteButton,
      deleteFallback,
    });

    if (typeof options.getSession === 'function') {
      try {
        const session = await options.getSession();
        controller.setSignedInState(Boolean(session?.accessToken || session?.user?.id));
      } catch {
        controller.setSignedInState(false);
      }
    }
  }

  window.LockInPopupDataControls = {
    initDataControlsSection,
    setSignedInState(isSignedIn) {
      controller?.setSignedInState(isSignedIn === true);
    },
  };
})();
