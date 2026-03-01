(() => {
  const TELEMETRY_OPT_OUT_KEY = 'lockin_telemetry_disabled';

  function showStatus(message, type) {
    window.LockInPopup?.showStatus?.(message, type);
  }

  function isDevelopmentExtension() {
    try {
      const manifest = chrome.runtime.getManifest();
      return !manifest.update_url;
    } catch {
      return true;
    }
  }

  async function initPrivacySection() {
    const toggle = document.getElementById('telemetry-toggle');
    const testBtn = document.getElementById('sentry-test-button');
    if (!toggle) return;

    try {
      const result = await chrome.storage.sync.get([TELEMETRY_OPT_OUT_KEY]);
      toggle.checked = result[TELEMETRY_OPT_OUT_KEY] !== true;
    } catch {
      toggle.checked = true;
    }

    toggle.addEventListener('change', async () => {
      try {
        await chrome.storage.sync.set({ [TELEMETRY_OPT_OUT_KEY]: !toggle.checked });
        showStatus(
          toggle.checked ? 'Error reporting enabled' : 'Error reporting disabled',
          'success',
        );
      } catch (error) {
        console.error('Failed to save telemetry preference:', error);
        showStatus('Failed to save preference', 'error');
      }
    });

    if (testBtn && isDevelopmentExtension()) {
      testBtn.style.display = 'block';
      testBtn.addEventListener('click', () => {
        if (window.LockInSentry && window.LockInSentry.isSentryInitialized()) {
          const result = window.LockInSentry.sendTestEvents();
          showStatus(result.message, result.success ? 'success' : 'error');
        } else {
          showStatus('Sentry not initialized - check DSN config', 'error');
        }
      });
    }
  }

  window.LockInPopupPrivacy = {
    initPrivacySection,
  };
})();
