(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const DEFAULT_TOKEN_EXPIRY_BUFFER_MS = 60000;

  function createConfig(lockinConfig) {
    const configSource = lockinConfig || (root ? root.LOCKIN_CONFIG : null);

    function getValue(key, fallback) {
      if (!configSource) return fallback;
      const value = configSource[key];
      return value === undefined || value === null || value === '' ? fallback : value;
    }

    function getBackendUrl() {
      return getValue('BACKEND_URL', 'http://localhost:3000');
    }

    function getSessionStorageKey() {
      return getValue('SESSION_STORAGE_KEY', 'lockinSupabaseSession');
    }

    function getSupabaseUrl() {
      return getValue('SUPABASE_URL', '');
    }

    function getSupabaseAnonKey() {
      return getValue('SUPABASE_ANON_KEY', '');
    }

    function getTokenExpiryBufferMs() {
      const raw = getValue('TOKEN_EXPIRY_BUFFER_MS', DEFAULT_TOKEN_EXPIRY_BUFFER_MS);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : DEFAULT_TOKEN_EXPIRY_BUFFER_MS;
    }

    return {
      getValue,
      getBackendUrl,
      getSessionStorageKey,
      getSupabaseUrl,
      getSupabaseAnonKey,
      getTokenExpiryBufferMs,
    };
  }

  registry.config = {
    createConfig,
  };
})();
