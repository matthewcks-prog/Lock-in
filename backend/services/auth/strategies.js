/**
 * JWT Verifier Strategies
 *
 * Pluggable verification strategies for different JWT signing algorithms.
 * Each strategy implements a common interface for use with JwtVerificationService.
 *
 * Strategies Available:
 * - JwksVerifierStrategy: Verifies JWTs using asymmetric keys from JWKS endpoint
 * - SymmetricVerifierStrategy: Verifies JWTs using symmetric key (HS256/HS384/HS512)
 * - SupabaseSdkVerifierStrategy: Delegates to Supabase SDK's auth.getUser()
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Each strategy handles one verification method
 * - Open/Closed: New strategies can be added without modifying existing ones
 * - Liskov Substitution: All strategies are interchangeable
 * - Dependency Inversion: Strategies depend on abstractions (JWT library interfaces)
 *
 * @module services/auth/strategies
 */

const jwt = require('jsonwebtoken');
const { createPublicKey } = require('crypto');
const { logger } = require('../../observability');

function normalizeJwtPayload(payload) {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    aud: payload.aud,
    iss: payload.iss,
    exp: payload.exp,
    iat: payload.iat,
    ...payload,
  };
}

/**
 * Strategy that verifies JWTs using JWKS (asymmetric keys)
 *
 * Supports: ES256, ES384, ES512, RS256, RS384, RS512, PS256, PS384, PS512
 */
class JwksVerifierStrategy {
  /**
   * Create a new JwksVerifierStrategy
   *
   * @param {Object} options - Configuration options
   * @param {JwksProvider} options.jwksProvider - Provider for fetching keys
   * @param {string[]} [options.allowedAlgorithms] - Allowed signing algorithms
   * @param {string} [options.issuer] - Expected token issuer
   * @param {string} [options.audience] - Expected token audience
   */
  constructor({
    jwksProvider,
    allowedAlgorithms = ['ES256', 'RS256'],
    issuer = null,
    audience = null,
  } = {}) {
    if (!jwksProvider) {
      throw new Error('JwksVerifierStrategy requires a jwksProvider');
    }

    this.name = 'jwks';
    this._jwksProvider = jwksProvider;
    this._allowedAlgorithms = allowedAlgorithms;
    this._issuer = issuer;
    this._audience = audience;
  }

  /**
   * Check if this strategy is available
   *
   * @returns {boolean} Always true - JWKS strategy is always available
   */
  isAvailable() {
    return true;
  }

  /**
   * Verify a JWT token using JWKS
   *
   * @param {string} token - The JWT to verify
   * @returns {Promise<Object>} Verification result
   */
  async verify(token) {
    try {
      // Decode header to get kid and alg
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || !decoded.header) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      const { kid, alg } = decoded.header;

      // Validate algorithm
      if (!this._allowedAlgorithms.includes(alg)) {
        return {
          valid: false,
          error: `Unsupported algorithm: ${alg}. Allowed: ${this._allowedAlgorithms.join(', ')}`,
        };
      }

      // Get the appropriate key
      let jwk;
      if (kid) {
        jwk = await this._jwksProvider.getKeyById(kid);
      } else {
        // Fallback to first key if no kid in token
        jwk = await this._jwksProvider.getFirstKey();
      }

      if (!jwk) {
        return { valid: false, error: `No matching key found for kid: ${kid || '(none)'}` };
      }

      // Convert JWK to Node.js crypto key
      const publicKey = createPublicKey({ key: jwk, format: 'jwk' });

      // Build verification options
      const verifyOptions = {
        algorithms: [alg],
      };

      if (this._issuer) {
        verifyOptions.issuer = this._issuer;
      }

      if (this._audience) {
        verifyOptions.audience = this._audience;
      }

      // Verify the token
      const payload = jwt.verify(token, publicKey, verifyOptions);

      return {
        valid: true,
        payload: normalizeJwtPayload(payload),
      };
    } catch (error) {
      logger.debug('[JwksVerifierStrategy] Verification failed:', { error: error.message });
      return { valid: false, error: error.message };
    }
  }
}

/**
 * Strategy that verifies JWTs using symmetric keys (HMAC)
 *
 * Supports: HS256, HS384, HS512
 *
 * WARNING: Symmetric keys are less secure than asymmetric keys.
 * Only use for legacy compatibility or when asymmetric keys are not available.
 */
class SymmetricVerifierStrategy {
  /**
   * Create a new SymmetricVerifierStrategy
   *
   * @param {Object} options - Configuration options
   * @param {string} options.secret - The symmetric secret key
   * @param {string[]} [options.allowedAlgorithms] - Allowed signing algorithms
   * @param {string} [options.issuer] - Expected token issuer
   * @param {string} [options.audience] - Expected token audience
   */
  constructor({
    secret,
    allowedAlgorithms = ['HS256', 'HS384', 'HS512'],
    issuer = null,
    audience = null,
  } = {}) {
    this.name = 'symmetric';
    this._secret = secret;
    this._allowedAlgorithms = allowedAlgorithms;
    this._issuer = issuer;
    this._audience = audience;
  }

  /**
   * Check if this strategy is available
   *
   * @returns {boolean} True if secret is configured
   */
  isAvailable() {
    return Boolean(this._secret);
  }

  /**
   * Verify a JWT token using symmetric key
   *
   * @param {string} token - The JWT to verify
   * @returns {Promise<Object>} Verification result
   */
  async verify(token) {
    if (!this._secret) {
      return { valid: false, error: 'No symmetric secret configured' };
    }

    try {
      // Build verification options
      const verifyOptions = {
        algorithms: this._allowedAlgorithms,
      };

      if (this._issuer) {
        verifyOptions.issuer = this._issuer;
      }

      if (this._audience) {
        verifyOptions.audience = this._audience;
      }

      // Verify the token
      const payload = jwt.verify(token, this._secret, verifyOptions);

      return {
        valid: true,
        payload: normalizeJwtPayload(payload),
      };
    } catch (error) {
      logger.debug('[SymmetricVerifierStrategy] Verification failed:', { error: error.message });
      return { valid: false, error: error.message };
    }
  }
}

/**
 * Strategy that delegates to Supabase SDK for verification
 *
 * This is the most reliable strategy for Supabase Cloud as it handles
 * all edge cases and key rotation automatically.
 *
 * NOTE: This strategy may fail when the Supabase circuit breaker is open.
 * When that happens, it returns a special error that signals the verification
 * service to try fallback strategies (e.g., JWKS or symmetric verification).
 */
class SupabaseSdkVerifierStrategy {
  /**
   * Create a new SupabaseSdkVerifierStrategy
   *
   * @param {Object} options - Configuration options
   * @param {Object} options.supabaseClient - Initialized Supabase client
   */
  constructor({ supabaseClient } = {}) {
    if (!supabaseClient) {
      throw new Error('SupabaseSdkVerifierStrategy requires a supabaseClient');
    }

    this.name = 'supabase-sdk';
    this._supabase = supabaseClient;
  }

  /**
   * Check if this strategy is available
   *
   * @returns {boolean} Always true if client is provided
   */
  isAvailable() {
    return Boolean(this._supabase);
  }

  /**
   * Check if an error is a circuit breaker error
   *
   * @param {Error} error - The error to check
   * @returns {boolean} True if this is a circuit breaker error
   */
  _isCircuitBreakerError(error) {
    if (!error) return false;
    return (
      error.name === 'CircuitOpenError' ||
      error.code === 'SERVICE_UNAVAILABLE' ||
      (error.message && error.message.includes('circuit open'))
    );
  }

  /**
   * Verify a JWT token using Supabase SDK
   *
   * @param {string} token - The JWT to verify
   * @returns {Promise<Object>} Verification result
   */
  async verify(token) {
    try {
      const { data, error } = await this._supabase.auth.getUser(token);

      if (error || !data?.user) {
        const errorMessage = error?.message || error?.name || 'User not found';

        // Check if this is a circuit breaker error - signal that fallback should be tried
        const isCircuitError = this._isCircuitBreakerError(error);
        if (isCircuitError) {
          logger.warn('[SupabaseSdkVerifierStrategy] Circuit breaker open, signaling fallback');
        }

        return {
          valid: false,
          error: errorMessage,
          // Signal to verification service that this is a transient error
          // and fallback strategies should be attempted
          isTransient: isCircuitError,
          isCircuitBreakerError: isCircuitError,
        };
      }

      return {
        valid: true,
        payload: data.user,
      };
    } catch (error) {
      const isCircuitError = this._isCircuitBreakerError(error);

      if (isCircuitError) {
        logger.warn('[SupabaseSdkVerifierStrategy] Circuit breaker error:', {
          error: error.message,
        });
      } else {
        logger.debug('[SupabaseSdkVerifierStrategy] Verification failed:', {
          error: error.message,
        });
      }

      return {
        valid: false,
        error: error.message,
        isTransient: isCircuitError,
        isCircuitBreakerError: isCircuitError,
      };
    }
  }
}

module.exports = {
  JwksVerifierStrategy,
  SymmetricVerifierStrategy,
  SupabaseSdkVerifierStrategy,
};
