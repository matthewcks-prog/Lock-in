(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createSettingsStore({ chromeClient, log, validators }) {
    const runtimeValidators =
      validators || registry.validators?.createRuntimeValidators?.() || null;
    const validateSettings =
      runtimeValidators?.validateSettings || ((value) => ({ ok: true, value: value || {} }));

    async function getSettings() {
      try {
        const stored = await chromeClient.storage.getSync(['preferredLanguage']);
        const result = validateSettings(stored);
        if (!result.ok) {
          log.warn('Invalid settings payload from storage:', result.error);
          return result.fallback;
        }
        return result.value;
      } catch (error) {
        log.warn('Failed to get settings:', error);
        return {};
      }
    }

    async function saveSettings(settings) {
      try {
        const result = validateSettings(settings || {});
        if (!result.ok) {
          log.warn('Invalid settings payload, storing sanitized fallback:', result.error);
        }
        await chromeClient.storage.setSync(result.ok ? result.value : result.fallback);
      } catch (error) {
        log.warn('Failed to save settings:', error);
      }
      return { success: true };
    }

    return {
      getSettings,
      saveSettings,
    };
  }

  registry.settings = {
    createSettingsStore,
  };
})();
