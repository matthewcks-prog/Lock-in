import {
  AppError,
  AuthError,
  ConflictError,
  ErrorCodes,
  type ErrorCode,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../core/errors';
import { HTTP_STATUS } from './constants';
import { resolveErrorCode } from './errorCodes';
import { parseRetryAfterMs } from './retry';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (!isRecord(body)) {
    return fallback;
  }

  const errorValue = body['error'];
  if (isRecord(errorValue) && typeof errorValue['message'] === 'string') {
    return errorValue['message'];
  }

  if (typeof errorValue === 'string') {
    return errorValue;
  }

  if (typeof body['message'] === 'string') {
    return body['message'];
  }

  return fallback;
}

function extractErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const errorValue = body['error'];
  if (isRecord(errorValue) && typeof errorValue['code'] === 'string') {
    return errorValue['code'];
  }

  if (typeof body['code'] === 'string') {
    return body['code'];
  }

  return undefined;
}

type ErrorMetadata = {
  message: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  retryAfterMs?: number;
  isRetryable: boolean;
};

const AUTH_ERROR_CODES = new Set<ErrorCode>([
  ErrorCodes.AUTH_REQUIRED,
  ErrorCodes.INVALID_TOKEN,
  ErrorCodes.SESSION_EXPIRED,
]);
const VALIDATION_ERROR_CODES = new Set<ErrorCode>([
  ErrorCodes.VALIDATION_ERROR,
  ErrorCodes.INVALID_INPUT,
  ErrorCodes.MISSING_REQUIRED_FIELD,
]);
const CONFLICT_ERROR_CODES = new Set<ErrorCode>([ErrorCodes.CONFLICT, ErrorCodes.ALREADY_EXISTS]);

function resolveErrorMetadata(response: Response, body: unknown): ErrorMetadata {
  const message = extractErrorMessage(body, 'API request failed');
  const code = resolveErrorCode(response.status, extractErrorCode(body));
  const details = isRecord(body)
    ? body
    : body !== null && body !== undefined
      ? { body }
      : undefined;
  const retryAfterMs =
    response.status === HTTP_STATUS.TOO_MANY_REQUESTS ? parseRetryAfterMs(response) : undefined;
  const isRetryable =
    response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR ||
    code === ErrorCodes.TIMEOUT ||
    code === ErrorCodes.SERVICE_UNAVAILABLE ||
    code === ErrorCodes.BAD_GATEWAY;
  const metadata: ErrorMetadata = { message, code, isRetryable };
  if (details !== undefined) {
    metadata.details = details;
  }
  if (retryAfterMs !== undefined) {
    metadata.retryAfterMs = retryAfterMs;
  }
  return metadata;
}

function toAppError(metadata: ErrorMetadata, response: Response, originalError?: Error): AppError {
  const baseOptions: { details?: Record<string, unknown>; cause?: Error } = {};
  if (metadata.details !== undefined) {
    baseOptions.details = metadata.details;
  }
  if (originalError !== undefined) {
    baseOptions.cause = originalError;
  }

  if (AUTH_ERROR_CODES.has(metadata.code)) {
    return new AuthError(metadata.message, metadata.code, {
      status: response.status,
      ...baseOptions,
    });
  }
  if (metadata.code === ErrorCodes.RATE_LIMIT) {
    return new RateLimitError(metadata.message, metadata.retryAfterMs, { ...baseOptions });
  }
  if (VALIDATION_ERROR_CODES.has(metadata.code)) {
    return new ValidationError(metadata.message, undefined, { ...baseOptions });
  }
  if (metadata.code === ErrorCodes.NOT_FOUND) {
    return new NotFoundError(metadata.message, undefined, undefined, { ...baseOptions });
  }
  if (CONFLICT_ERROR_CODES.has(metadata.code)) {
    return new ConflictError(metadata.message, undefined, { ...baseOptions });
  }
  return new AppError(metadata.message, metadata.code, {
    status: response.status,
    isRetryable: metadata.isRetryable,
    ...baseOptions,
  });
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }
}

export async function createApiError(response: Response, originalError?: Error): Promise<AppError> {
  const body = await readErrorBody(response);
  const metadata = resolveErrorMetadata(response, body);
  return toAppError(metadata, response, originalError);
}
