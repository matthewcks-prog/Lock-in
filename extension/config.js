/**
 * Extension Runtime Configuration
 *
 * Environment-aware configuration injected at build time.
 * Set VITE_APP_ENV=production for prod builds, defaults to development.
 *
 * Build commands:
 * - Development: npm run build (uses DEV Supabase)
 * - Production: VITE_APP_ENV=production npm run build (uses PROD Supabase)
 */
(function () {
  const root = typeof window !== 'undefined' ? window : self;
  if (root.LOCKIN_CONFIG) {
    return;
  }

  // Environment selection
  // In bundled context (Vite), import.meta.env is available
  // In plain script context (popup.html), we default to development
  let APP_ENV = 'development';
  try {
    // This will be replaced by Vite at build time for bundled files
    // For non-bundled files (like popup.html loading config.js directly),
    // this throws and we catch it, defaulting to 'development'
    if (typeof __VITE_APP_ENV__ !== 'undefined') {
      APP_ENV = __VITE_APP_ENV__;
    }
  } catch (e) {
    // Fallback to development
  }

  const IS_PRODUCTION = APP_ENV === 'production';

  // Environment-specific Supabase configuration
  const SUPABASE_CONFIG = IS_PRODUCTION
    ? {
        // Production environment (vtuflatvllpldohhimao)
        url: 'https://vtuflatvllpldohhimao.supabase.co',
        anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dWZsYXR2bGxwbGRvaGhpbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Nzc4NjUsImV4cCI6MjA4NDE1Mzg2NX0.yoP_BCxVUPOLXiEg2Rb_-BbihPHCXjgfE1lCDUYfvvU',
        environment: 'production',
      }
    : {
        // Development environment (uszxfuzauetcchwcgufe)
        url: 'https://uszxfuzauetcchwcgufe.supabase.co',
        anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzenhmdXphdWV0Y2Nod2NndWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MzM4MzgsImV4cCI6MjA4MDAwOTgzOH0.iiCytIONfubK7ZkDJj95cAiOl_jjMimbfYWDrMhDw7E',
        environment: 'development',
      };

  root.LOCKIN_CONFIG = {
    APP_ENV,
    IS_PRODUCTION,
    // NOTE: Update BACKEND_URL after deploying to Azure Container Apps in lock-in-dev resource group
    // Run: .\scripts\azure-setup.ps1 -ResourceGroup lock-in-dev -Location australiaeast
    // The new URL will be: https://lock-in-backend.<env-id>.australiaeast.azurecontainerapps.io
    BACKEND_URL: IS_PRODUCTION
      ? 'https://lock-in-backend.australiaeast.azurecontainerapps.io' // TODO: Update after Azure deployment
      : 'http://localhost:3000',
    SUPABASE_URL: SUPABASE_CONFIG.url,
    SUPABASE_ANON_KEY: SUPABASE_CONFIG.anonKey,
    SUPABASE_ENVIRONMENT: SUPABASE_CONFIG.environment,
    SESSION_STORAGE_KEY: 'lockinSupabaseSession',
    TOKEN_EXPIRY_BUFFER_MS: 60000,
    DEBUG_PANOPTO_RESOLVER: !IS_PRODUCTION, // Debug only in dev
    // SENTRY_DSN: Injected at build time via VITE_SENTRY_DSN environment variable
    // For local development, add VITE_SENTRY_DSN to .env in project root
  };

  // Log configuration in development (helpful for debugging)
  if (!IS_PRODUCTION && typeof console !== 'undefined') {
    console.log('[Lock-in] Extension config loaded:', {
      environment: APP_ENV,
      supabase: SUPABASE_CONFIG.environment,
      backendUrl: root.LOCKIN_CONFIG.BACKEND_URL,
    });
  }
})();
