(() => {
  const DEFAULT_TELEMETRY_OPT_OUT_KEY = 'lockin_telemetry_disabled';

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
            : 'Unexpected popup privacy error object',
      };
    }
    return { message: String(error) };
  }

  function getTelemetryOptOutKey() {
    const key = window.LOCKIN_CONFIG?.CLIENT_STORAGE?.KEYS?.TELEMETRY_DISABLED;
    return typeof key === 'string' && key.length > 0 ? key : DEFAULT_TELEMETRY_OPT_OUT_KEY;
  }

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
    const telemetryOptOutKey = getTelemetryOptOutKey();
    const toggle = document.getElementById('telemetry-toggle');
    const testBtn = document.getElementById('sentry-test-button');
    if (!toggle) return;

    try {
      const result = await chrome.storage.sync.get([telemetryOptOutKey]);
      toggle.checked = result[telemetryOptOutKey] !== true;
    } catch {
      toggle.checked = true;
    }

    toggle.addEventListener('change', async () => {
      try {
        await chrome.storage.sync.set({ [telemetryOptOutKey]: !toggle.checked });
        showStatus(
          toggle.checked ? 'Error reporting enabled' : 'Error reporting disabled',
          'success',
        );
      } catch (error) {
        console.error('Failed to save telemetry preference:', toSafeErrorLog(error));
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
