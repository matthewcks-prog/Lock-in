const { supabase } = require('../db/supabaseClient');
const config = require('../config');
const { createJwtVerifierForConfig } = require('../services/auth');
const { logger } = require('../observability');
const HTTP_STATUS = require('../constants/httpStatus');

let _jwtVerifier = null;
const AUTH_RETRY_AFTER_SECONDS = 30;

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

function _resetJwtVerifier() {
  _jwtVerifier = null;
}

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

function sendUnauthorizedResponse(res) {
  return res.status(HTTP_STATUS.UNAUTHORIZED).json({
    error: 'Invalid or expired token',
    code: 'auth/invalid-token',
  });
}

function sendMissingTokenResponse(res) {
  return res.status(HTTP_STATUS.UNAUTHORIZED).json({
    error: 'Missing or invalid Authorization header',
    code: 'auth/missing-token',
  });
}

function sendServiceUnavailableResponse(res) {
  return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
    error: 'Authentication service temporarily unavailable',
    code: 'auth/service-unavailable',
    retryAfter: AUTH_RETRY_AFTER_SECONDS,
  });
}

function sendInternalErrorResponse(res) {
  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    error: 'Authentication service error',
    code: 'auth/internal-error',
  });
}

function isCircuitBreakerError(error) {
  return (
    error.name === 'CircuitOpenError' ||
    error.code === 'SERVICE_UNAVAILABLE' ||
    (error.message && error.message.includes('circuit open'))
  );
}

function handleInvalidVerificationResult(result, res) {
  if (result.isServiceUnavailable) {
    logger.warn('[Auth] All auth strategies unavailable (circuit breaker):', {
      error: result.error,
    });
    return sendServiceUnavailableResponse(res);
  }

  logger.warn('[Auth] Token verification failed:', {
    error: result.error,
    strategy: result.strategy,
  });

  return sendUnauthorizedResponse(res);
}

function attachAuthenticatedUser(req, result) {
  req.user = result.payload;
  logger.debug('[Auth] User authenticated', {
    userId: req.user.id,
    strategy: result.strategy,
  });
}

async function requireSupabaseUser(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return sendMissingTokenResponse(res);
    }

    const verifier = getJwtVerifier();
    const result = await verifier.verify(token);
    if (!result.valid) {
      return handleInvalidVerificationResult(result, res);
    }

    attachAuthenticatedUser(req, result);
    next();
  } catch (error) {
    if (isCircuitBreakerError(error)) {
      logger.warn('[Auth] Circuit breaker open:', { error: error.message });
      return sendServiceUnavailableResponse(res);
    }

    logger.error('[Auth] Unexpected authentication error:', {
      error: error.message,
      stack: error.stack,
    });

    return sendInternalErrorResponse(res);
  }
}

module.exports = {
  requireSupabaseUser,
  extractBearerToken,
  getJwtVerifier,
  _resetJwtVerifier,
};
