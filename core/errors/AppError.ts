/**
 * Standardized Application Error Types
 *
 * Provides a consistent error handling pattern across the application.
 * These error types help with:
 * - Consistent error codes for API responses
 * - Better error messages for users
 * - Easier debugging in development
 * - Proper error categorization for logging/monitoring
 */

/**
 * Error codes used throughout the application
 */
export const ErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Rate limiting
  RATE_LIMIT: 'RATE_LIMIT',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_GATEWAY: 'BAD_GATEWAY',

  // Client errors
  ABORTED: 'ABORTED',
  PARSE_ERROR: 'PARSE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Base application error class
 * Extends Error with additional properties for better error handling
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status?: number;
  readonly details?: Record<string, unknown>;
  readonly isRetryable: boolean;
  readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    options?: {
      status?: number;
      details?: Record<string, unknown>;
      isRetryable?: boolean;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (options?.status !== undefined) {
      this.status = options.status;
    }
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    this.isRetryable = options?.isRetryable ?? false;
    this.timestamp = new Date().toISOString();

    // Preserve stack trace in V8 environments (Node.js, Chrome)
    const ErrorWithCaptureStackTrace = Error as typeof Error & {
      captureStackTrace?: (target: object, constructor: Function) => void;
    };
    if (typeof ErrorWithCaptureStackTrace.captureStackTrace === 'function') {
      ErrorWithCaptureStackTrace.captureStackTrace(this, AppError);
    }

    // Set cause if provided (for error chaining)
    if (options?.cause) {
      (this as Error & { cause?: Error }).cause = options.cause;
    }
  }

  /**
   * Convert to JSON for logging/API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
    };
  }

  /**
   * Get a user-friendly message for display
   */
  getUserMessage(): string {
    switch (this.code) {
      case ErrorCodes.AUTH_REQUIRED:
        return 'Please sign in to continue';
      case ErrorCodes.SESSION_EXPIRED:
        return 'Your session has expired. Please sign in again.';
      case ErrorCodes.NETWORK_ERROR:
        return 'Unable to connect. Please check your internet connection.';
      case ErrorCodes.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorCodes.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable. Please try again later.';
      case ErrorCodes.NOT_FOUND:
        return 'The requested resource was not found';
      default:
        return this.message || 'An unexpected error occurred';
    }
  }
}

/**
 * Authentication error
 */
export class AuthError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: ErrorCode = ErrorCodes.AUTH_REQUIRED,
    options?: { status?: number; details?: Record<string, unknown>; cause?: Error },
  ) {
    super(message, code, { ...options, status: options?.status ?? 401, isRetryable: false });
    this.name = 'AuthError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  readonly field?: string;

  constructor(
    message: string,
    field?: string,
    options?: { details?: Record<string, unknown>; cause?: Error },
  ) {
    super(message, ErrorCodes.VALIDATION_ERROR, { ...options, status: 400, isRetryable: false });
    this.name = 'ValidationError';
    if (field !== undefined) {
      this.field = field;
    }
  }
}

/**
 * Network error
 */
export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed', options?: { cause?: Error }) {
    super(message, ErrorCodes.NETWORK_ERROR, { ...options, isRetryable: true });
    this.name = 'NetworkError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  readonly resourceType?: string;
  readonly resourceId?: string;

  constructor(
    message: string = 'Resource not found',
    resourceType?: string,
    resourceId?: string,
    options?: { cause?: Error },
  ) {
    super(message, ErrorCodes.NOT_FOUND, { ...options, status: 404, isRetryable: false });
    this.name = 'NotFoundError';
    if (resourceType !== undefined) {
      this.resourceType = resourceType;
    }
    if (resourceId !== undefined) {
      this.resourceId = resourceId;
    }
  }
}

/**
 * Conflict error (for optimistic locking)
 */
export class ConflictError extends AppError {
  readonly serverVersion?: string;

  constructor(
    message: string = 'Resource was modified by another session',
    serverVersion?: string,
    options?: { cause?: Error },
  ) {
    super(message, ErrorCodes.CONFLICT, { ...options, status: 409, isRetryable: true });
    this.name = 'ConflictError';
    if (serverVersion !== undefined) {
      this.serverVersion = serverVersion;
    }
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  readonly retryAfterMs?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfterMs?: number,
    options?: { cause?: Error },
  ) {
    const rateLimitOptions: {
      status?: number;
      details?: Record<string, unknown>;
      isRetryable?: boolean;
      cause?: Error;
    } = { status: 429, isRetryable: true, ...options };
    if (retryAfterMs) {
      rateLimitOptions.details = { retryAfterMs };
    }
    super(message, ErrorCodes.RATE_LIMIT, rateLimitOptions);
    this.name = 'RateLimitError';
    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

/**
 * Helper to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper to wrap unknown errors as AppError
 */
export function wrapError(error: unknown, fallbackMessage?: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for known error codes on the error object
    const errorMeta = error as Error & { code?: unknown; status?: unknown };
    const code = typeof errorMeta.code === 'string' ? (errorMeta.code as ErrorCode) : undefined;
    const status = typeof errorMeta.status === 'number' ? errorMeta.status : undefined;

    if (code && Object.values(ErrorCodes).includes(code)) {
      const options: { status?: number; cause?: Error } = { cause: error };
      if (status !== undefined) {
        options.status = status;
      }
      return new AppError(error.message, code, options);
    }

    return new AppError(
      error.message || fallbackMessage || 'An error occurred',
      ErrorCodes.INTERNAL_ERROR,
      {
        cause: error,
      },
    );
  }

  if (typeof error === 'string') {
    return new AppError(error, ErrorCodes.INTERNAL_ERROR);
  }

  return new AppError(fallbackMessage || 'An unexpected error occurred', ErrorCodes.INTERNAL_ERROR);
}
