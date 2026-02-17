/**
 * Environment Variable Validation Utility
 *
 * Provides fail-fast validation for required environment variables.
 */

const ENV_DEVELOPMENT = 'development';
const ENV_PRODUCTION = 'production';
const PROD_ONLY_SUFFIX = '[PROD ONLY]';
const DEV_ONLY_SUFFIX = '[DEV ONLY]';
const SHOW_SUCCESS_FLAG = 'SHOW_ENV_VALIDATION_SUCCESS';
const SHOW_SUCCESS_VALUE = 'true';

// Simple console color helpers (no dependencies)
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
};

class ValidationError extends Error {
  constructor(message, missing = []) {
    super(message);
    this.name = 'ValidationError';
    this.missing = missing;
  }
}

function getCurrentEnvironment(envValues = process.env) {
  return envValues.NODE_ENV || ENV_DEVELOPMENT;
}

function hasNonEmptyEnvValue(key, envValues = process.env) {
  const value = envValues[key];
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function formatMissingVariable(key, description, suffix = '') {
  return suffix ? `${key} (${description}) ${suffix}` : `${key} (${description})`;
}

function collectMissingVariables(requiredMap, suffix = '', envValues = process.env) {
  if (!requiredMap) return [];

  const missing = [];
  for (const [key, description] of Object.entries(requiredMap)) {
    if (!hasNonEmptyEnvValue(key, envValues)) {
      missing.push(formatMissingVariable(key, description, suffix));
    }
  }
  return missing;
}

function collectAtLeastOneErrors(atLeastOneMap, envValues = process.env) {
  if (!atLeastOneMap) return [];

  const errors = [];
  for (const [groupName, keys] of Object.entries(atLeastOneMap)) {
    const hasAnyKey = keys.some((key) => hasNonEmptyEnvValue(key, envValues));
    if (!hasAnyKey) {
      errors.push(`${groupName}: At least one of [${keys.join(', ')}] must be set`);
    }
  }
  return errors;
}

function normalizeWarningRules(warnings) {
  if (Array.isArray(warnings)) {
    return warnings.filter(
      (rule) => typeof rule?.when === 'function' && typeof rule?.message === 'string',
    );
  }
  return [];
}

function collectWarningMessages(warnings, envValues = process.env) {
  const rules = normalizeWarningRules(warnings);
  const messages = [];

  for (const rule of rules) {
    if (rule.when(envValues)) {
      messages.push(rule.message);
    }
  }
  return messages;
}

/**
 * Validates that required environment variables are set.
 *
 * @param {Object} schema - Validation schema
 * @returns {{valid:boolean, errors:string[], warnings:string[]}}
 */
function validateEnv(schema = {}) {
  const env = getCurrentEnvironment();
  const isProd = env === ENV_PRODUCTION;
  const isDev = env === ENV_DEVELOPMENT;
  const errors = [
    ...collectMissingVariables(schema.required),
    ...(isProd ? collectMissingVariables(schema.requiredInProd, PROD_ONLY_SUFFIX) : []),
    ...(isDev ? collectMissingVariables(schema.requiredInDev, DEV_ONLY_SUFFIX) : []),
    ...collectAtLeastOneErrors(schema.atLeastOne),
  ];
  const warnings = collectWarningMessages(schema.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

function printWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return;

  console.warn(colors.yellow('Environment configuration warnings:'));
  warnings.forEach((warning) => console.warn(colors.yellow(`  - ${warning}`)));
  console.warn('');
}

function printValidationFailure(env, errors) {
  console.error(colors.red('Environment validation failed'));
  console.error(colors.red(`  Current environment: ${env}`));
  console.error('');
  console.error(colors.red('Missing required variables:'));
  errors.forEach((error) => console.error(colors.red(`  - ${error}`)));
  console.error('');
  console.error(colors.yellow('Fix:'));
  console.error(colors.yellow('  1. Copy backend/.env.example to backend/.env'));
  console.error(colors.yellow('  2. Fill in the required values'));
  console.error(colors.yellow('  3. Restart the server'));
  console.error('');
}

function printSuccessWhenVerbose(envValues = process.env) {
  if (envValues[SHOW_SUCCESS_FLAG] === SHOW_SUCCESS_VALUE) {
    console.log(colors.green('Environment validation passed'));
  }
}

/**
 * Validates and exits on configuration errors.
 *
 * @param {Object} schema - Validation schema (same as validateEnv)
 */
function validateEnvOrExit(schema) {
  const env = getCurrentEnvironment();
  const result = validateEnv(schema);

  printWarnings(result.warnings);

  if (!result.valid) {
    printValidationFailure(env, result.errors);
    process.exit(1);
  }

  printSuccessWhenVerbose();
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

  warnings: [
    {
      when: (envValues) =>
        Boolean(
          envValues.SUPABASE_URL && !envValues.SUPABASE_URL_DEV && !envValues.SUPABASE_URL_PROD,
        ),
      message: 'Found legacy SUPABASE_URL. Use SUPABASE_URL_DEV or SUPABASE_URL_PROD instead.',
    },
    {
      when: (envValues) =>
        Boolean(
          envValues.SUPABASE_SERVICE_ROLE_KEY &&
          !envValues.SUPABASE_SERVICE_ROLE_KEY_DEV &&
          !envValues.SUPABASE_SERVICE_ROLE_KEY_PROD,
        ),
      message: 'Found legacy SUPABASE_SERVICE_ROLE_KEY. Use environment-specific keys instead.',
    },
    {
      when: (envValues) =>
        envValues.NODE_ENV === ENV_DEVELOPMENT && Boolean(envValues.SUPABASE_URL_PROD),
      message: 'NODE_ENV=development but SUPABASE_URL_PROD is set. Risk of accidental prod writes.',
    },
    {
      when: (envValues) =>
        envValues.NODE_ENV === ENV_PRODUCTION && Boolean(envValues.SUPABASE_URL_DEV),
      message: 'NODE_ENV=production but SUPABASE_URL_DEV is set. Should only have prod vars.',
    },
  ],
};

module.exports = {
  validateEnv,
  validateEnvOrExit,
  ValidationError,
  LOCKIN_BACKEND_SCHEMA,
};
