/**
 * Backend error types (shared across services, middleware, and controllers).
 */

const HTTP_STATUS = require('../constants/httpStatus');

const ERROR_STATUS_MAP = {
  VALIDATION_ERROR: HTTP_STATUS.BAD_REQUEST,
  INVALID_INPUT: HTTP_STATUS.BAD_REQUEST,
  MISSING_REQUIRED_FIELD: HTTP_STATUS.BAD_REQUEST,
  INVALID_JSON: HTTP_STATUS.BAD_REQUEST,
  PARSE_ERROR: HTTP_STATUS.BAD_GATEWAY,
  AUTH_REQUIRED: HTTP_STATUS.UNAUTHORIZED,
  INVALID_TOKEN: HTTP_STATUS.UNAUTHORIZED,
  SESSION_EXPIRED: HTTP_STATUS.UNAUTHORIZED,
  FORBIDDEN: HTTP_STATUS.FORBIDDEN,
  NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  CONFLICT: HTTP_STATUS.CONFLICT,
  RATE_LIMIT: HTTP_STATUS.TOO_MANY_REQUESTS,
  ABORTED: HTTP_STATUS.REQUEST_TIMEOUT,
  TIMEOUT: HTTP_STATUS.GATEWAY_TIMEOUT,
  DEADLINE_EXCEEDED: HTTP_STATUS.GATEWAY_TIMEOUT,
  INTERNAL_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  BAD_GATEWAY: HTTP_STATUS.BAD_GATEWAY,
  SERVICE_UNAVAILABLE: HTTP_STATUS.SERVICE_UNAVAILABLE,
};

class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode || ERROR_STATUS_MAP[code] || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.details = details;
    this.isOperational = true; // Distinguishes from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', HTTP_STATUS.NOT_FOUND);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR', HTTP_STATUS.BAD_REQUEST, field ? { field } : null);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource was modified by another session', updatedAt = null) {
    super(message, 'CONFLICT', HTTP_STATUS.CONFLICT, updatedAt ? { updatedAt } : null);
    this.updatedAt = updatedAt;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds = null) {
    super(
      message,
      'RATE_LIMIT',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      retryAfterSeconds ? { retryAfterSeconds } : null,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Request timed out', details = null) {
    super(message, 'TIMEOUT', HTTP_STATUS.GATEWAY_TIMEOUT, details);
    this.name = 'TimeoutError';
  }
}

class DeadlineExceededError extends AppError {
  constructor(message = 'Request deadline exceeded', details = null) {
    super(message, 'DEADLINE_EXCEEDED', HTTP_STATUS.GATEWAY_TIMEOUT, details);
    this.name = 'DeadlineExceededError';
  }
}

class AbortError extends AppError {
  constructor(message = 'Request aborted', details = null) {
    super(message, 'ABORTED', HTTP_STATUS.REQUEST_TIMEOUT, details);
    this.name = 'AbortError';
  }
}

module.exports = {
  ERROR_STATUS_MAP,
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  TimeoutError,
  DeadlineExceededError,
  AbortError,
};
