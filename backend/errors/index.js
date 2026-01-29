/**
 * Backend error types (shared across services, middleware, and controllers).
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

class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR', 400, field ? { field } : null);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource was modified by another session', updatedAt = null) {
    super(message, 'CONFLICT', 409, updatedAt ? { updatedAt } : null);
    this.updatedAt = updatedAt;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds = null) {
    super(message, 'RATE_LIMIT', 429, retryAfterSeconds ? { retryAfterSeconds } : null);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

module.exports = {
  ERROR_STATUS_MAP,
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
};
