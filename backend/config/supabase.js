const { IS_PRODUCTION } = require('./env');

/**
 * Get environment-aware Supabase configuration.
 *
 * Environment isolation:
 * - Production: Uses SUPABASE_URL_PROD and SUPABASE_SERVICE_ROLE_KEY_PROD
 * - Development/Staging: Uses SUPABASE_URL_DEV and SUPABASE_SERVICE_ROLE_KEY_DEV
 * - Local: Uses local Supabase (http://127.0.0.1:54321) with JWKS for ES256 verification
 *
 * JWT Verification Strategy (Supabase CLI v1.x+):
 * - Local Supabase now uses ES256 (ECDSA) for JWT signing
 * - Tokens are verified using JWKS endpoint at /auth/v1/.well-known/jwks.json
 * - Legacy HS256 secret is kept as fallback for older installations
 *
 * No fallbacks to legacy vars - fail fast if vars are misconfigured.
 * Validation is handled by utils/validateEnv.js at startup.
 */
function getSupabaseConfig() {
  if (IS_PRODUCTION) {
    return {
      url: process.env.SUPABASE_URL_PROD,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
      anonKey: process.env.SUPABASE_ANON_KEY_PROD,
      jwtSecret: process.env.SUPABASE_JWT_SECRET, // Legacy symmetric key (fallback)
      environment: 'production',
      isLocal: false,
    };
  }

  // Development or staging
  const devUrl = process.env.SUPABASE_URL_DEV;

  // Detect local Supabase: matches 127.0.0.1, localhost, or host.docker.internal (Docker)
  // Also matches the standard Supabase local port 54321
  const isLocalSupabase = Boolean(
    devUrl &&
    (devUrl.includes('127.0.0.1') ||
      devUrl.includes('localhost') ||
      devUrl.includes('host.docker.internal') ||
      devUrl.includes(':54321')),
  );

  return {
    url: devUrl,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_DEV,
    anonKey: process.env.SUPABASE_ANON_KEY_DEV,
    jwtSecret: process.env.SUPABASE_JWT_SECRET, // Legacy symmetric key (fallback for HS256)
    environment: 'development',
    isLocal: isLocalSupabase,
  };
}

const SUPABASE_CONFIG = getSupabaseConfig();

module.exports = {
  SUPABASE_CONFIG,
  SUPABASE_URL: SUPABASE_CONFIG.url,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_CONFIG.serviceRoleKey,
  SUPABASE_ANON_KEY: SUPABASE_CONFIG.anonKey,
  SUPABASE_JWT_SECRET: SUPABASE_CONFIG.jwtSecret,
  SUPABASE_IS_LOCAL: SUPABASE_CONFIG.isLocal,
};
