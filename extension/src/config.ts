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
type AppEnv = 'development' | 'production';

type LockInConfig = {
  APP_ENV: AppEnv;
  IS_PRODUCTION: boolean;
  BACKEND_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_ENVIRONMENT: AppEnv;
  SESSION_STORAGE_KEY: string;
  TOKEN_EXPIRY_BUFFER_MS: number;
  DEBUG_PANOPTO_RESOLVER: boolean;
  DEBUG?: string;
  SENTRY_DSN?: string;
};

type SupabaseEnvConfig = {
  url: string;
  anonKey: string;
  environment: AppEnv;
  backendUrl: string;
};

const DEFAULT_DEV_BACKEND_URL = 'http://localhost:3000';
const DEFAULT_PROD_BACKEND_URL = 'https://lock-in-backend.australiaeast.azurecontainerapps.io';
const TOKEN_EXPIRY_BUFFER_MS = 60000;

const root = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & {
  LOCKIN_CONFIG?: LockInConfig;
};

function getEnvValue(key: string): string | undefined {
  const env = import.meta.env as Record<string, unknown>;
  const raw = env[key];
  return typeof raw === 'string' ? raw : undefined;
}

function resolveEnvString(key: string, fallback: string): string {
  const value = getEnvValue(key);
  if (value !== undefined && value.length > 0) {
    return value;
  }
  return fallback;
}

function getAppEnv(): AppEnv {
  const raw = getEnvValue('VITE_APP_ENV');
  const normalized = typeof raw === 'string' ? raw.toLowerCase() : '';
  return normalized === 'production' ? 'production' : 'development';
}

function buildConfigByEnv(): Record<AppEnv, SupabaseEnvConfig> {
  return {
    development: {
      url: resolveEnvString('VITE_SUPABASE_URL_DEV', ''),
      anonKey: resolveEnvString('VITE_SUPABASE_ANON_KEY_DEV', ''),
      environment: 'development',
      backendUrl: resolveEnvString('VITE_BACKEND_URL_DEV', DEFAULT_DEV_BACKEND_URL),
    },
    production: {
      url: resolveEnvString('VITE_SUPABASE_URL_PROD', ''),
      anonKey: resolveEnvString('VITE_SUPABASE_ANON_KEY_PROD', ''),
      environment: 'production',
      backendUrl: resolveEnvString('VITE_BACKEND_URL_PROD', DEFAULT_PROD_BACKEND_URL),
    },
  } as const;
}

function collectMissingEnvVars(
  envConfig: { url: string; anonKey: string },
  isProd: boolean,
): string[] {
  const missing: string[] = [];
  if (envConfig.url.length === 0) {
    missing.push(isProd ? 'VITE_SUPABASE_URL_PROD' : 'VITE_SUPABASE_URL_DEV');
  }
  if (envConfig.anonKey.length === 0) {
    missing.push(isProd ? 'VITE_SUPABASE_ANON_KEY_PROD' : 'VITE_SUPABASE_ANON_KEY_DEV');
  }
  return missing;
}

function logMissingEnvVars(missing: string[]): void {
  if (missing.length > 0 && typeof console !== 'undefined') {
    console.warn('[Lock-in] Missing extension env vars:', missing);
  }
}

function logDevConfig(env: string, isProd: boolean, config: LockInConfig): void {
  if (!isProd && typeof console !== 'undefined') {
    console.log('[Lock-in] Extension config loaded:', {
      environment: env,
      supabase: config.SUPABASE_ENVIRONMENT,
      backendUrl: config.BACKEND_URL,
    });
  }
}

type RuntimeConfigResult = {
  config: LockInConfig;
  appEnv: AppEnv;
  isProduction: boolean;
  missingEnvVars: string[];
};

function buildRuntimeConfig(): RuntimeConfigResult {
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
    TOKEN_EXPIRY_BUFFER_MS,
    DEBUG_PANOPTO_RESOLVER: !isProduction,
  };

  const debugValue = getEnvValue('VITE_DEBUG');
  if (debugValue !== undefined && debugValue.length > 0) {
    runtimeConfig.DEBUG = debugValue;
  }

  const sentryDsn = getEnvValue('VITE_SENTRY_DSN');
  if (sentryDsn !== undefined && sentryDsn.length > 0) {
    runtimeConfig.SENTRY_DSN = sentryDsn;
  }

  return { config: runtimeConfig, appEnv, isProduction, missingEnvVars };
}

if (root.LOCKIN_CONFIG === undefined) {
  const { config, appEnv, isProduction, missingEnvVars } = buildRuntimeConfig();
  root.LOCKIN_CONFIG = config;
  logMissingEnvVars(missingEnvVars);
  logDevConfig(appEnv, isProduction, config);
}
