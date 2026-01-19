(function () {
  'use strict';
  (function () {
    const root = typeof window !== 'undefined' ? window : self;
    if (root.LOCKIN_CONFIG) {
      return;
    }
    const appEnv = 'development'.toLowerCase();
    const isProduction = appEnv === 'production';
    const configByEnv = {
      development: {
        url: 'https://uszxfuzauetcchwcgufe.supabase.co',
        anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzenhmdXphdWV0Y2Nod2NndWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MzM4MzgsImV4cCI6MjA4MDAwOTgzOH0.iiCytIONfubK7ZkDJj95cAiOl_jjMimbfYWDrMhDw7E',
        environment: 'development',
        backendUrl: 'http://localhost:3000',
      },
      production: {
        url: 'https://vtuflatvllpldohhimao.supabase.co',
        anonKey: 'your-prod-anon-key',
        environment: 'production',
        backendUrl: 'https://lock-in-backend.australiaeast.azurecontainerapps.io',
      },
    };
    const supabaseConfig = isProduction ? configByEnv.production : configByEnv.development;
    const missingEnvVars = [];
    root.LOCKIN_CONFIG = {
      APP_ENV: appEnv,
      IS_PRODUCTION: isProduction,
      BACKEND_URL: supabaseConfig.backendUrl,
      SUPABASE_URL: supabaseConfig.url,
      SUPABASE_ANON_KEY: supabaseConfig.anonKey,
      SUPABASE_ENVIRONMENT: supabaseConfig.environment,
      SESSION_STORAGE_KEY: 'lockinSupabaseSession',
      TOKEN_EXPIRY_BUFFER_MS: 6e4,
      DEBUG_PANOPTO_RESOLVER: !isProduction,
      DEBUG: void 0,
      SENTRY_DSN: 'https://xxx@xxx.ingest.sentry.io/xxx',
    };
    if (missingEnvVars.length > 0 && typeof console !== 'undefined') {
      console.warn('[Lock-in] Missing extension env vars:', missingEnvVars);
    }
    if (!isProduction && typeof console !== 'undefined') {
      console.log('[Lock-in] Extension config loaded:', {
        environment: appEnv,
        supabase: supabaseConfig.environment,
        backendUrl: root.LOCKIN_CONFIG.BACKEND_URL,
      });
    }
  })();
})();
//# sourceMappingURL=config.js.map
