/**
 * Centralized Error Handler Middleware
 *
 * Provides consistent error responses across all API endpoints.
 *
 * Features:
 * - Consistent error response format
 * - Error logging with context
 * - Different handling for development vs production
 * - Support for known error types
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Standard error response format
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false for errors
 * @property {Object} error - Error details
 * @property {string} error.code - Machine-readable error code
 * @property {string} error.message - Human-readable error message
 * @property {Object} [error.details] - Additional error details (dev only)
 */

/**
 * Map of known error codes to HTTP status codes
 */
const ERROR_STATUS_MAP = {
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  MISSING_REQUIRED_FIELD: 400,
  INVALID_JSON: 400,
  AUTH_REQUIRED: 401,
  INVALID_TOKEN: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode || ERROR_STATUS_MAP[code] || 500;
    this.details = details;
    this.isOperational = true; // Distinguishes from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

/**
 * Validation error
 */
class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR', 400, field ? { field } : null);
  }
}

/**
 * Conflict error (for optimistic locking)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource was modified by another session', updatedAt = null) {
    super(message, 'CONFLICT', 409, updatedAt ? { updatedAt } : null);
    this.updatedAt = updatedAt;
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds = null) {
    super(message, 'RATE_LIMIT', 429, retryAfterSeconds ? { retryAfterSeconds } : null);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Format error for response
 */
function formatErrorResponse(err, includeStack = false) {
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  };

  // Include details in development or for operational errors
  if (err.details && (isDev || err.isOperational)) {
    response.error.details = err.details;
  }

  // Include stack trace in development
  if (includeStack && isDev && err.stack) {
    response.error.stack = err.stack;
  }

  return response;
}

/**
 * Log error with context
 */
function logError(err, req) {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: req.user?.id || 'anonymous',
    errorCode: err.code || 'UNKNOWN',
    errorMessage: err.message,
    statusCode: err.statusCode || 500,
  };

  // Always log operational errors at info/warn level
  // Log programming errors at error level
  if (err.isOperational) {
    if (err.statusCode >= 500) {
      console.error('[API Error]', JSON.stringify(logData));
    } else {
      console.warn('[API Warning]', JSON.stringify(logData));
    }
  } else {
    // Programming error - log with stack trace
    console.error('[API Critical Error]', JSON.stringify(logData), err.stack);
  }
}

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
function errorHandler(err, req, res, _next) {
  // Log the error
  logError(err, req);

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;

  // Handle specific error types
  if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError' || err.code === 'AUTH_REQUIRED') {
    statusCode = 401;
  } else if (err.code === 'PGRST116') {
    // Supabase "no rows found" error
    statusCode = 404;
    err.code = 'NOT_FOUND';
    err.message = err.message || 'Resource not found';
  }

  // Don't expose internal error details in production
  const errorResponse = formatErrorResponse(err, isDev);

  if (err.updatedAt && typeof err.updatedAt === 'string') {
    errorResponse.updatedAt = err.updatedAt;
  } else if (err.details && typeof err.details.updatedAt === 'string') {
    errorResponse.updatedAt = err.details.updatedAt;
  }

  // Set appropriate headers for rate limit errors
  // Support both RATE_LIMIT and TRANSCRIPT_RATE_LIMIT error codes
  const isRateLimitError = err.code === 'RATE_LIMIT' || err.code === 'TRANSCRIPT_RATE_LIMIT';
  const retryAfter = err.retryAfterSeconds || err.details?.retryAfterSeconds;
  if (isRateLimitError && retryAfter) {
    res.set('Retry-After', String(retryAfter));
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
};
