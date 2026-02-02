/**
 * JWT Verifier Factory
 *
 * Creates a properly configured JwtVerificationService based on environment
 * and configuration. This factory encapsulates the complexity of choosing
 * the right verification strategy for different deployment scenarios.
 *
 * Deployment Scenarios:
 * 1. Local Supabase (ES256): Uses JWKS endpoint for asymmetric key verification
 * 2. Local Supabase (Legacy HS256): Falls back to symmetric key verification
 * 3. Cloud Supabase: Uses Supabase SDK for most reliable verification
 *
 * @module services/auth/jwtVerifierFactory
 */

const { JwtVerificationService } = require('./jwtVerificationService');
const { JwksProvider } = require('./jwksProvider');
const {
  JwksVerifierStrategy,
  SymmetricVerifierStrategy,
  SupabaseSdkVerifierStrategy,
} = require('./strategies');
const { logger } = require('../../observability');

/**
 * Create a JWT verifier service configured for the current environment
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.config - Application configuration
 * @param {Object} [options.supabaseClient] - Supabase client for SDK verification
 * @returns {JwtVerificationService} Configured verification service
 */
function createJwtVerifierForConfig({ config, supabaseClient = null }) {
  const strategies = [];

  const isLocal = config.SUPABASE_IS_LOCAL;
  const supabaseUrl = config.SUPABASE_URL;
  const jwtSecret = config.SUPABASE_JWT_SECRET;

  logger.info('[JwtVerifierFactory] Creating verifier', {
    isLocal,
    hasJwtSecret: Boolean(jwtSecret),
    hasSupabaseClient: Boolean(supabaseClient),
  });

  if (isLocal) {
    // Local Supabase: Try JWKS first (ES256), then symmetric (HS256) as fallback

    // Strategy 1: JWKS verification for ES256 tokens (Supabase CLI v1.x+)
    const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

    try {
      const jwksProvider = new JwksProvider({ jwksUri });
      // Local Supabase uses the auth endpoint as the issuer
      const localIssuer = `${supabaseUrl}/auth/v1`;
      const jwksStrategy = new JwksVerifierStrategy({
        jwksProvider,
        allowedAlgorithms: ['ES256', 'RS256'],
        issuer: localIssuer,
      });
      strategies.push(jwksStrategy);
      logger.debug('[JwtVerifierFactory] Added JWKS strategy for local Supabase', {
        issuer: localIssuer,
      });
    } catch (error) {
      logger.warn('[JwtVerifierFactory] Failed to create JWKS strategy:', { error: error.message });
    }

    // Strategy 2: Symmetric key verification (legacy HS256 tokens)
    if (jwtSecret) {
      const symmetricStrategy = new SymmetricVerifierStrategy({
        secret: jwtSecret,
        allowedAlgorithms: ['HS256', 'HS384', 'HS512'],
      });
      strategies.push(symmetricStrategy);
      logger.debug('[JwtVerifierFactory] Added symmetric strategy for legacy tokens');
    }

    // Strategy 3: Supabase SDK as last resort for local (user tokens)
    if (supabaseClient) {
      const sdkStrategy = new SupabaseSdkVerifierStrategy({
        supabaseClient,
      });
      strategies.push(sdkStrategy);
      logger.debug('[JwtVerifierFactory] Added Supabase SDK strategy');
    }
  } else {
    // Cloud Supabase: SDK first (most reliable), then JWKS, then symmetric

    // Strategy 1: Supabase SDK (recommended for cloud)
    if (supabaseClient) {
      const sdkStrategy = new SupabaseSdkVerifierStrategy({
        supabaseClient,
      });
      strategies.push(sdkStrategy);
      logger.debug('[JwtVerifierFactory] Added Supabase SDK strategy for cloud');
    }

    // Strategy 2: JWKS verification (for third-party tokens or custom signing keys)
    if (supabaseUrl) {
      const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

      try {
        const jwksProvider = new JwksProvider({ jwksUri });
        const jwksStrategy = new JwksVerifierStrategy({
          jwksProvider,
          allowedAlgorithms: ['ES256', 'RS256'],
        });
        strategies.push(jwksStrategy);
        logger.debug('[JwtVerifierFactory] Added JWKS strategy for cloud');
      } catch (error) {
        logger.warn('[JwtVerifierFactory] Failed to create JWKS strategy:', {
          error: error.message,
        });
      }
    }

    // Strategy 3: Symmetric key (legacy, discouraged)
    if (jwtSecret) {
      const symmetricStrategy = new SymmetricVerifierStrategy({
        secret: jwtSecret,
        allowedAlgorithms: ['HS256', 'HS384', 'HS512'],
      });
      strategies.push(symmetricStrategy);
      logger.warn(
        '[JwtVerifierFactory] Using symmetric key verification - consider migrating to asymmetric keys',
      );
    }
  }

  if (strategies.length === 0) {
    throw new Error(
      'No JWT verification strategies available. ' +
        'Configure SUPABASE_JWT_SECRET or ensure Supabase client is available.',
    );
  }

  return new JwtVerificationService({ strategies });
}

module.exports = { createJwtVerifierForConfig };
