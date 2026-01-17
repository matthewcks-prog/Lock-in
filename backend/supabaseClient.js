const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Use environment-aware configuration from centralized config
const SUPABASE_URL = config.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    `CRITICAL: Supabase credentials missing for ${config.NODE_ENV} environment.`,
    'Backend will not function correctly.',
    `Environment: ${config.SUPABASE_CONFIG.environment}`,
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

module.exports = {
  supabase,
};
