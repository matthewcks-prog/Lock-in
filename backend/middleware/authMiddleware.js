const { supabase } = require('../db/supabaseClient');
const config = require('../config');
const { createJwtVerifierForConfig } = require('../services/auth');
const { logger } = require('../observability');

/**
 * Authentication Middleware for Supabase
 *
 * Provides robust JWT verification with support for multiple signing algorithms
 * and automatic fallback between verification strategies.
 *
 * Supported Scenarios:
 * - Local Supabase (ES256): JWKS-based asymmetric key verification
 * - Local Supabase (Legacy HS256): Symmetric key verification
 * - Cloud Supabase: Supabase SDK verification (recommended)
 *
 * ARCHITECTURE NOTE:
 * - This middleware is responsible for authentication ONLY
 * - It validates tokens and attaches user to req.user
 * - Business logic should remain in services layer
 * - Uses Strategy Pattern for pluggable verification methods
 *
 * SOLID PRINCIPLES:
 * - Single Responsibility: Token extraction and user attachment only
 * - Open/Closed: New verification strategies added in services/auth
 * - Dependency Inversion: Depends on JwtVerificationService abstraction
 *
 * @module middleware/authMiddleware
 */

// Singleton instance of the JWT verifier, lazily initialized
let _jwtVerifier = null;

/**
 * Get or create the JWT verifier instance
 *
 * Uses lazy initialization to allow config to be fully loaded.
 * Singleton pattern ensures we reuse JWKS cache across requests.
 *
 * @returns {JwtVerificationService} The verifier instance
 */
function getJwtVerifier() {
  if (!_jwtVerifier) {
    _jwtVerifier = createJwtVerifierForConfig({
      config,
      supabaseClient: supabase,
    });

    logger.info('[Auth] JWT verifier initialized', {
      strategies: _jwtVerifier.getAvailableStrategies(),
      isLocal: config.SUPABASE_IS_LOCAL,
    });
  }
  return _jwtVerifier;
}

/**
 * Reset the JWT verifier (useful for testing)
 *
 * @internal
 */
function _resetJwtVerifier() {
  _jwtVerifier = null;
}

/**
 * Extract Bearer token from Authorization header
 *
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null} The token or null if not found
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const prefix = 'Bearer ';
  if (authHeader.startsWith(prefix)) {
    return authHeader.slice(prefix.length).trim() || null;
  }

  return null;
}

/**
 * Middleware that requires a valid Supabase user token
 *
 * Extracts the JWT from the Authorization header, verifies it using
 * the configured strategies, and attaches the user to req.user.
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next function
 */
async function requireSupabaseUser(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: 'Missing or invalid Authorization header',
        code: 'auth/missing-token',
      });
    }

    // Verify the token using configured strategies
    const verifier = getJwtVerifier();
    const result = await verifier.verify(token);

    if (!result.valid) {
      logger.warn('[Auth] Token verification failed:', {
        error: result.error,
        strategy: result.strategy,
      });

      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'auth/invalid-token',
      });
    }

    // Attach user to request
    req.user = result.payload;

    // Log successful authentication (debug level)
    logger.debug('[Auth] User authenticated', {
      userId: req.user.id,
      strategy: result.strategy,
    });

    next();
  } catch (error) {
    logger.error('[Auth] Unexpected authentication error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Authentication service error',
      code: 'auth/internal-error',
    });
  }
}

module.exports = {
  requireSupabaseUser,
  // Exported for testing
  extractBearerToken,
  getJwtVerifier,
  _resetJwtVerifier,
};
