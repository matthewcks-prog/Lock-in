(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const handlers = registry.handlers || (registry.handlers = {});

  function createSettingsHandlers({ settingsStore }) {
    async function getSettingsHandler({ respond }) {
      const data = await settingsStore.getSettings();
      return respond.success(data);
    }

    async function updateSettingsHandler({ payload, respond }) {
      const settings = payload?.settings || {};
      await settingsStore.saveSettings(settings);
      return respond.success({ success: true });
    }

    return {
      getSettings: getSettingsHandler,
      GET_SETTINGS: getSettingsHandler,
      saveSettings: updateSettingsHandler,
      UPDATE_SETTINGS: updateSettingsHandler,
    };
  }

  handlers.createSettingsHandlers = createSettingsHandlers;
})();
