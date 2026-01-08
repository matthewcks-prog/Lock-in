/**
 * Error Types Module
 *
 * Exports all error types and utilities for consistent error handling.
 */

export {
  AppError,
  AuthError,
  ValidationError,
  NetworkError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ErrorCodes,
  isAppError,
  wrapError,
} from './AppError';

export type { ErrorCode } from './AppError';
