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
        url: '',
        anonKey: '',
        environment: 'production',
        backendUrl: 'https://lock-in-backend.australiaeast.azurecontainerapps.io',
      },
    };
    const supabaseConfig = isProduction ? configByEnv.production : configByEnv.development;
    const missingEnvVars = [];
    if (!supabaseConfig.url) {
      missingEnvVars.push(isProduction ? 'VITE_SUPABASE_URL_PROD' : 'VITE_SUPABASE_URL_DEV');
    }
    if (!supabaseConfig.anonKey) {
      missingEnvVars.push(
        isProduction ? 'VITE_SUPABASE_ANON_KEY_PROD' : 'VITE_SUPABASE_ANON_KEY_DEV',
      );
    }
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
      SENTRY_DSN:
        'https://21082d74fe5921d137a1877d77201243@o4510681730777088.ingest.us.sentry.io/4510681770229760',
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
