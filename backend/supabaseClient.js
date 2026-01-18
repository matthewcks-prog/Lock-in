const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Use environment-aware configuration from centralized config
const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY;

// Check if we're in a test environment (tests set these vars before requiring)
const IS_TEST = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  if (!IS_TEST) {
    console.error(
      `CRITICAL: Supabase credentials missing for ${config.NODE_ENV} environment.`,
      'Backend will not function correctly.',
      `Environment: ${config.SUPABASE_CONFIG.environment}`,
    );
  }
}

// Create client only if we have valid credentials, otherwise create a dummy
// that will fail gracefully when accessed (for test environments)
let supabase;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
} else {
  // Placeholder for tests - will be mocked by tests that need it
  supabase = {
    from: () => {
      throw new Error(
        'Supabase not configured. Set SUPABASE_URL_DEV and SUPABASE_SERVICE_ROLE_KEY_DEV.',
      );
    },
  };
}

module.exports = {
  supabase,
};
