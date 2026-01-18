/**
 * Environment Variable Validation Utility
 *
 * Provides fail-fast validation for required environment variables.
 * Prevents runtime errors by checking configuration at startup.
 *
 * Industry best practices:
 * - Fail fast: Validate on startup, not on first use
 * - Clear errors: Tell developers exactly what's missing
 * - Environment-aware: Different requirements for dev/prod
 * - Single source of truth: One place for all validation logic
 */

// Simple console color helpers (no dependencies)
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  reset: (text) => text,
};

class ValidationError extends Error {
  constructor(message, missing = []) {
    super(message);
    this.name = 'ValidationError';
    this.missing = missing;
  }
}

/**
 * Validates that required environment variables are set.
 *
 * @param {Object} schema - Validation schema
 * @param {Object} schema.required - Always required variables (all environments)
 * @param {Object} schema.requiredInProd - Required only in production
 * @param {Object} schema.atLeastOne - At least one from the list must be set
 * @returns {Object} Validation result { valid, errors, warnings }
 */
function validateEnv(schema = {}) {
  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';
  const isDev = env === 'development';

  const errors = [];
  const warnings = [];

  // Check always-required variables
  if (schema.required) {
    for (const [key, description] of Object.entries(schema.required)) {
      if (!process.env[key]) {
        errors.push(`${key} (${description})`);
      }
    }
  }

  // Check production-only requirements
  if (isProd && schema.requiredInProd) {
    for (const [key, description] of Object.entries(schema.requiredInProd)) {
      if (!process.env[key]) {
        errors.push(`${key} (${description}) [PROD ONLY]`);
      }
    }
  }

  // Check development-only requirements
  if (isDev && schema.requiredInDev) {
    for (const [key, description] of Object.entries(schema.requiredInDev)) {
      if (!process.env[key]) {
        errors.push(`${key} (${description}) [DEV ONLY]`);
      }
    }
  }

  // Check "at least one" requirements
  if (schema.atLeastOne) {
    for (const [groupName, keys] of Object.entries(schema.atLeastOne)) {
      const hasAtLeastOne = keys.some((key) => process.env[key]);
      if (!hasAtLeastOne) {
        errors.push(`${groupName}: At least one of [${keys.join(', ')}] must be set`);
      }
    }
  }

  // Check for common misconfigurations
  if (schema.warnings) {
    for (const [condition, message] of Object.entries(schema.warnings)) {
      if (eval(condition)) {
        warnings.push(message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates and fails fast if required variables are missing.
 * Prints colored output to help developers quickly identify issues.
 *
 * @param {Object} schema - Validation schema (same as validateEnv)
 * @throws {ValidationError} If validation fails
 */
function validateEnvOrExit(schema) {
  const env = process.env.NODE_ENV || 'development';
  const result = validateEnv(schema);

  if (result.warnings.length > 0) {
    console.warn(colors.yellow('⚠️  Environment Configuration Warnings:'));
    result.warnings.forEach((warning) => {
      console.warn(colors.yellow(`   - ${warning}`));
    });
    console.warn('');
  }

  if (!result.valid) {
    console.error(colors.red('❌ Environment Validation Failed'));
    console.error(colors.red(`   Current environment: ${env}`));
    console.error('');
    console.error(colors.red('Missing required variables:'));
    result.errors.forEach((error) => {
      console.error(colors.red(`   ❌ ${error}`));
    });
    console.error('');
    console.error(colors.yellow('💡 Fix:'));
    console.error(colors.yellow('   1. Copy backend/.env.example to backend/.env'));
    console.error(colors.yellow('   2. Fill in the required values'));
    console.error(colors.yellow('   3. Restart the server'));
    console.error('');

    // Exit with error code
    process.exit(1);
  }

  // Success message (only in verbose mode)
  if (process.env.SHOW_ENV_VALIDATION_SUCCESS === 'true') {
    console.log(colors.green('✅ Environment validation passed'));
  }
}

/**
 * Lock-in Backend validation schema
 */
const LOCKIN_BACKEND_SCHEMA = {
  required: {
    NODE_ENV: 'Environment (development|staging|production)',
  },

  requiredInDev: {
    SUPABASE_URL_DEV: 'Development Supabase URL',
    SUPABASE_SERVICE_ROLE_KEY_DEV: 'Development Supabase service role key',
  },

  requiredInProd: {
    SUPABASE_URL_PROD: 'Production Supabase URL',
    SUPABASE_SERVICE_ROLE_KEY_PROD: 'Production Supabase service role key',
  },

  atLeastOne: {
    'AI Provider': ['AZURE_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  },

  warnings: {
    'process.env.SUPABASE_URL && !process.env.SUPABASE_URL_DEV && !process.env.SUPABASE_URL_PROD':
      'Found legacy SUPABASE_URL. Use SUPABASE_URL_DEV or SUPABASE_URL_PROD instead.',
    'process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY_DEV && !process.env.SUPABASE_SERVICE_ROLE_KEY_PROD':
      'Found legacy SUPABASE_SERVICE_ROLE_KEY. Use environment-specific keys instead.',
    'process.env.NODE_ENV === "development" && process.env.SUPABASE_URL_PROD':
      'NODE_ENV=development but SUPABASE_URL_PROD is set. Risk of accidental prod writes!',
    'process.env.NODE_ENV === "production" && process.env.SUPABASE_URL_DEV':
      'NODE_ENV=production but SUPABASE_URL_DEV is set. Should only have prod vars.',
  },
};

module.exports = {
  validateEnv,
  validateEnvOrExit,
  ValidationError,
  LOCKIN_BACKEND_SCHEMA,
};
