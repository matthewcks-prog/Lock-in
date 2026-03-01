/**
 * JWT Verifier Factory
 *
 * Creates a properly configured JwtVerificationService based on environment
 * and configuration.
 */

const { JwtVerificationService } = require('./jwtVerificationService');
const { JwksProvider } = require('./jwksProvider');
const {
  JwksVerifierStrategy,
  SymmetricVerifierStrategy,
  SupabaseSdkVerifierStrategy,
} = require('./strategies');
const { logger } = require('../../observability');

const LOCAL_JWT_ALGORITHMS = ['ES256', 'RS256'];
const CLOUD_JWT_ALGORITHMS = ['ES256', 'RS256'];
const SYMMETRIC_ALGORITHMS = ['HS256', 'HS384', 'HS512'];
const JWKS_PATH = '/auth/v1/.well-known/jwks.json';

function buildJwksUri(supabaseUrl) {
  return `${supabaseUrl}${JWKS_PATH}`;
}

function createJwksStrategy({ jwksUri, allowedAlgorithms, issuer }) {
  const jwksProvider = new JwksProvider({ jwksUri });
  return new JwksVerifierStrategy({
    jwksProvider,
    allowedAlgorithms,
    issuer: issuer ?? null,
  });
}

function createSymmetricStrategy(jwtSecret) {
  return new SymmetricVerifierStrategy({
    secret: jwtSecret,
    allowedAlgorithms: SYMMETRIC_ALGORITHMS,
  });
}

function createSdkStrategy(supabaseClient) {
  return new SupabaseSdkVerifierStrategy({ supabaseClient });
}

function addLocalJwksStrategy(strategies, supabaseUrl) {
  const jwksUri = buildJwksUri(supabaseUrl);
  const localIssuer = `${supabaseUrl}/auth/v1`;

  try {
    const strategy = createJwksStrategy({
      jwksUri,
      allowedAlgorithms: LOCAL_JWT_ALGORITHMS,
      issuer: localIssuer,
    });
    strategies.push(strategy);
    logger.debug('[JwtVerifierFactory] Added JWKS strategy for local Supabase', {
      issuer: localIssuer,
    });
  } catch (error) {
    logger.warn('[JwtVerifierFactory] Failed to create JWKS strategy:', {
      error: error.message,
    });
  }
}

function addCloudJwksStrategy(strategies, supabaseUrl) {
  if (!supabaseUrl) {
    return;
  }

  try {
    const strategy = createJwksStrategy({
      jwksUri: buildJwksUri(supabaseUrl),
      allowedAlgorithms: CLOUD_JWT_ALGORITHMS,
    });
    strategies.push(strategy);
    logger.debug('[JwtVerifierFactory] Added JWKS strategy for cloud');
  } catch (error) {
    logger.warn('[JwtVerifierFactory] Failed to create JWKS strategy:', {
      error: error.message,
    });
  }
}

function addLocalStrategies(strategies, { supabaseUrl, jwtSecret, supabaseClient }) {
  addLocalJwksStrategy(strategies, supabaseUrl);

  if (jwtSecret) {
    strategies.push(createSymmetricStrategy(jwtSecret));
    logger.debug('[JwtVerifierFactory] Added symmetric strategy for legacy tokens');
  }

  if (supabaseClient) {
    strategies.push(createSdkStrategy(supabaseClient));
    logger.debug('[JwtVerifierFactory] Added Supabase SDK strategy');
  }
}

function addCloudStrategies(strategies, { supabaseUrl, jwtSecret, supabaseClient }) {
  if (supabaseClient) {
    strategies.push(createSdkStrategy(supabaseClient));
    logger.debug('[JwtVerifierFactory] Added Supabase SDK strategy for cloud');
  }

  addCloudJwksStrategy(strategies, supabaseUrl);

  if (jwtSecret) {
    strategies.push(createSymmetricStrategy(jwtSecret));
    logger.warn(
      '[JwtVerifierFactory] Using symmetric key verification - consider migrating to asymmetric keys',
    );
  }
}

function logVerifierConfiguration({ isLocal, jwtSecret, supabaseClient }) {
  logger.info('[JwtVerifierFactory] Creating verifier', {
    isLocal,
    hasJwtSecret: Boolean(jwtSecret),
    hasSupabaseClient: Boolean(supabaseClient),
  });
}

function assertStrategiesAvailable(strategies) {
  if (strategies.length === 0) {
    throw new Error(
      'No JWT verification strategies available. ' +
        'Configure SUPABASE_JWT_SECRET or ensure Supabase client is available.',
    );
  }
}

/**
 * Create a JWT verifier service configured for the current environment
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.config - Application configuration
 * @param {Object} [options.supabaseClient] - Supabase client for SDK verification
 * @returns {JwtVerificationService} Configured verification service
 */
function createJwtVerifierForConfig({ config, supabaseClient = null }) {
  const isLocal = config.SUPABASE_IS_LOCAL;
  const supabaseUrl = config.SUPABASE_URL;
  const jwtSecret = config.SUPABASE_JWT_SECRET;
  const strategies = [];

  logVerifierConfiguration({ isLocal, jwtSecret, supabaseClient });

  if (isLocal) {
    addLocalStrategies(strategies, { supabaseUrl, jwtSecret, supabaseClient });
  } else {
    addCloudStrategies(strategies, { supabaseUrl, jwtSecret, supabaseClient });
  }

  assertStrategiesAvailable(strategies);
  return new JwtVerificationService({ strategies });
}

module.exports = { createJwtVerifierForConfig };
