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

const HTTP_STATUS_UNAUTHORIZED = 401;
const FALLBACK_UNEXPECTED_MESSAGE = 'An unexpected error occurred';

const DEFAULT_USER_MESSAGES: Partial<Record<ErrorCode, string>> = {
  [ErrorCodes.AUTH_REQUIRED]: 'Please sign in to continue',
  [ErrorCodes.INVALID_TOKEN]: 'Your session is invalid. Please sign in again.',
  [ErrorCodes.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCodes.VALIDATION_ERROR]: 'Some information is missing or invalid. Please check your input.',
  [ErrorCodes.INVALID_INPUT]: 'Some information is missing or invalid. Please check your input.',
  [ErrorCodes.MISSING_REQUIRED_FIELD]:
    'Some information is missing or invalid. Please check your input.',
  [ErrorCodes.ALREADY_EXISTS]: 'That item already exists.',
  [ErrorCodes.CONFLICT]: 'Another change occurred. Please refresh and try again.',
  [ErrorCodes.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
  [ErrorCodes.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCodes.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCodes.BAD_GATEWAY]: 'The server is unavailable. Please try again later.',
  [ErrorCodes.ABORTED]: 'The request was cancelled. Please try again.',
  [ErrorCodes.PARSE_ERROR]: 'We could not read the response. Please try again.',
  [ErrorCodes.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found',
};

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
    if (options?.cause !== undefined) {
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
    const mapped = DEFAULT_USER_MESSAGES[this.code];
    if (mapped !== undefined) {
      return mapped;
    }
    return this.message.length > 0 ? this.message : FALLBACK_UNEXPECTED_MESSAGE;
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
    super(message, code, {
      ...options,
      status: options?.status ?? HTTP_STATUS_UNAUTHORIZED,
      isRetryable: false,
    });
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
 * Timeout error
 */
export class TimeoutError extends AppError {
  readonly operationName: string;
  readonly timeoutMs: number;

  constructor(
    operationName: string,
    timeoutMs: number,
    message?: string,
    options?: { cause?: Error },
  ) {
    const fallback = `Operation '${operationName}' timed out after ${timeoutMs}ms`;
    super(message ?? fallback, ErrorCodes.TIMEOUT, {
      ...options,
      status: 504,
      isRetryable: true,
    });
    this.name = 'TimeoutError';
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
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
    if (retryAfterMs !== undefined) {
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

    if (code !== undefined && Object.values(ErrorCodes).includes(code)) {
      const options: { status?: number; cause?: Error } = { cause: error };
      if (status !== undefined) {
        options.status = status;
      }
      return new AppError(error.message, code, options);
    }

    const fallback =
      typeof fallbackMessage === 'string' && fallbackMessage.length > 0
        ? fallbackMessage
        : 'An error occurred';
    const message = error.message.length > 0 ? error.message : fallback;
    return new AppError(message, ErrorCodes.INTERNAL_ERROR, {
      cause: error,
    });
  }

  if (typeof error === 'string') {
    return new AppError(error, ErrorCodes.INTERNAL_ERROR);
  }

  const finalMessage =
    typeof fallbackMessage === 'string' && fallbackMessage.length > 0
      ? fallbackMessage
      : 'An unexpected error occurred';
  return new AppError(finalMessage, ErrorCodes.INTERNAL_ERROR);
}
