/**
 * Extension Runtime Configuration
 *
 * Environment-aware configuration injected at build time via Vite.
 * Set VITE_APP_ENV=production for prod builds, defaults to development.
 *
 * Build commands:
 * - Development: npm run build (uses DEV Supabase)
 * - Production: VITE_APP_ENV=production npm run build (uses PROD Supabase)
 */
(function () {
  type LockInConfig = {
    APP_ENV: string;
    IS_PRODUCTION: boolean;
    BACKEND_URL: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_ENVIRONMENT: 'development' | 'production';
    SESSION_STORAGE_KEY: string;
    TOKEN_EXPIRY_BUFFER_MS: number;
    DEBUG_PANOPTO_RESOLVER: boolean;
    DEBUG?: string;
    SENTRY_DSN?: string;
  };

  const root = (typeof window !== 'undefined' ? window : self) as typeof globalThis & {
    LOCKIN_CONFIG?: LockInConfig;
  };
  if (root.LOCKIN_CONFIG) {
    return;
  }

  function getAppEnv() {
    return (import.meta.env['VITE_APP_ENV'] || 'development').toLowerCase();
  }

  function buildConfigByEnv() {
    return {
      development: {
        url: import.meta.env['VITE_SUPABASE_URL_DEV'] || '',
        anonKey: import.meta.env['VITE_SUPABASE_ANON_KEY_DEV'] || '',
        environment: 'development',
        backendUrl: import.meta.env['VITE_BACKEND_URL_DEV'] || 'http://localhost:3000',
      },
      production: {
        url: import.meta.env['VITE_SUPABASE_URL_PROD'] || '',
        anonKey: import.meta.env['VITE_SUPABASE_ANON_KEY_PROD'] || '',
        environment: 'production',
        backendUrl:
          import.meta.env['VITE_BACKEND_URL_PROD'] ||
          'https://lock-in-backend.australiaeast.azurecontainerapps.io',
      },
    } as const;
  }

  function collectMissingEnvVars(envConfig: { url: string; anonKey: string }, isProd: boolean) {
    const missing: string[] = [];
    if (!envConfig.url) {
      missing.push(isProd ? 'VITE_SUPABASE_URL_PROD' : 'VITE_SUPABASE_URL_DEV');
    }
    if (!envConfig.anonKey) {
      missing.push(isProd ? 'VITE_SUPABASE_ANON_KEY_PROD' : 'VITE_SUPABASE_ANON_KEY_DEV');
    }
    return missing;
  }

  function logMissingEnvVars(missing: string[]) {
    if (missing.length > 0 && typeof console !== 'undefined') {
      console.warn('[Lock-in] Missing extension env vars:', missing);
    }
  }

  function logDevConfig(env: string, isProd: boolean, config: LockInConfig) {
    if (!isProd && typeof console !== 'undefined') {
      console.log('[Lock-in] Extension config loaded:', {
        environment: env,
        supabase: config.SUPABASE_ENVIRONMENT,
        backendUrl: config.BACKEND_URL,
      });
    }
  }

  const appEnv = getAppEnv();
  const isProduction = appEnv === 'production';
  const configByEnv = buildConfigByEnv();
  const supabaseConfig = isProduction ? configByEnv.production : configByEnv.development;
  const missingEnvVars = collectMissingEnvVars(supabaseConfig, isProduction);

  const runtimeConfig: LockInConfig = {
    APP_ENV: appEnv,
    IS_PRODUCTION: isProduction,
    BACKEND_URL: supabaseConfig.backendUrl,
    SUPABASE_URL: supabaseConfig.url,
    SUPABASE_ANON_KEY: supabaseConfig.anonKey,
    SUPABASE_ENVIRONMENT: supabaseConfig.environment,
    SESSION_STORAGE_KEY: 'lockinSupabaseSession',
    TOKEN_EXPIRY_BUFFER_MS: 60000,
    DEBUG_PANOPTO_RESOLVER: !isProduction,
  };
  const debugValue = import.meta.env['VITE_DEBUG'];
  if (debugValue) {
    runtimeConfig.DEBUG = debugValue;
  }
  const sentryDsn = import.meta.env['VITE_SENTRY_DSN'];
  if (sentryDsn) {
    runtimeConfig.SENTRY_DSN = sentryDsn;
  }

  root.LOCKIN_CONFIG = runtimeConfig;

  logMissingEnvVars(missingEnvVars);
  logDevConfig(appEnv, isProduction, runtimeConfig);
})();
