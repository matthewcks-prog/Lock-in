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
import { EXTERNAL_LINKS } from './config/externalLinks';
import { MONASH_MOODLE_HOSTS } from './config/hostRules';
import {
  CLIENT_STORAGE_CLEAR_SCOPE,
  CLIENT_STORAGE_KEY_ALIASES,
  CLIENT_STORAGE_KEYS,
  CLIENT_STORAGE_PREFIXES,
} from '../../core/storage/clientStorageKeys';

type AppEnv = 'development' | 'production';
type PolicyLinks = {
  TERMS_OF_SERVICE: string;
  PRIVACY_POLICY: string;
};

type ClientStorageConfig = {
  KEYS: typeof CLIENT_STORAGE_KEYS;
  ALIASES: Record<string, readonly string[]>;
  PREFIXES: typeof CLIENT_STORAGE_PREFIXES;
  CLEAR_SCOPE: typeof CLIENT_STORAGE_CLEAR_SCOPE;
};

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
  EXTERNAL_LINKS: typeof EXTERNAL_LINKS;
  MONASH_MOODLE_HOSTS: readonly string[];
  POLICY_LINKS: PolicyLinks;
  CLIENT_STORAGE: ClientStorageConfig;
  REPO_URL: string;
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
const DEFAULT_REPO_URL = 'https://github.com/matthewcks-prog/Lock-in';
const DEFAULT_TERMS_OF_SERVICE_URL = `${DEFAULT_REPO_URL}/blob/main/TERMS.md`;
const DEFAULT_PRIVACY_POLICY_URL = `${DEFAULT_REPO_URL}/blob/main/PRIVACY.md`;
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
  const policyLinks: PolicyLinks = {
    TERMS_OF_SERVICE: resolveEnvString('VITE_TERMS_OF_SERVICE_URL', DEFAULT_TERMS_OF_SERVICE_URL),
    PRIVACY_POLICY: resolveEnvString('VITE_PRIVACY_POLICY_URL', DEFAULT_PRIVACY_POLICY_URL),
  };
  const repoUrl = resolveEnvString('VITE_REPO_URL', DEFAULT_REPO_URL);

  const runtimeConfig: LockInConfig = {
    APP_ENV: appEnv,
    IS_PRODUCTION: isProduction,
    BACKEND_URL: supabaseConfig.backendUrl,
    SUPABASE_URL: supabaseConfig.url,
    SUPABASE_ANON_KEY: supabaseConfig.anonKey,
    SUPABASE_ENVIRONMENT: supabaseConfig.environment,
    SESSION_STORAGE_KEY: CLIENT_STORAGE_KEYS.SUPABASE_SESSION,
    TOKEN_EXPIRY_BUFFER_MS,
    DEBUG_PANOPTO_RESOLVER: !isProduction,
    EXTERNAL_LINKS,
    MONASH_MOODLE_HOSTS,
    POLICY_LINKS: policyLinks,
    CLIENT_STORAGE: {
      KEYS: CLIENT_STORAGE_KEYS,
      ALIASES: CLIENT_STORAGE_KEY_ALIASES,
      PREFIXES: CLIENT_STORAGE_PREFIXES,
      CLEAR_SCOPE: CLIENT_STORAGE_CLEAR_SCOPE,
    },
    REPO_URL: repoUrl,
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
