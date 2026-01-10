(function () {
  const root = typeof window !== 'undefined' ? window : self;
  if (root.LOCKIN_CONFIG) {
    return;
  }

  root.LOCKIN_CONFIG = {
    BACKEND_URL: 'http://localhost:3000',
    SUPABASE_URL: 'https://uszxfuzauetcchwcgufe.supabase.co',
    SUPABASE_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzenhmdXphdWV0Y2Nod2NndWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MzM4MzgsImV4cCI6MjA4MDAwOTgzOH0.iiCytIONfubK7ZkDJj95cAiOl_jjMimbfYWDrMhDw7E',
    SESSION_STORAGE_KEY: 'lockinSupabaseSession',
    TOKEN_EXPIRY_BUFFER_MS: 60000,
    DEBUG_PANOPTO_RESOLVER: false,
    // SENTRY_DSN: Injected at build time via VITE_SENTRY_DSN environment variable
    // For local development, add VITE_SENTRY_DSN to .env in project root
  };
})();
