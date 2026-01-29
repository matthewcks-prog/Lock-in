(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createSettingsStore({ chromeClient, log }) {
    async function getSettings() {
      try {
        return await chromeClient.storage.getSync(['preferredLanguage']);
      } catch (error) {
        log.warn('Failed to get settings:', error);
        return {};
      }
    }

    async function saveSettings(settings) {
      try {
        await chromeClient.storage.setSync(settings || {});
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
