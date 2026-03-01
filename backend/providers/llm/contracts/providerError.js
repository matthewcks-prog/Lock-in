const { AppError } = require('../../../errors');
const HTTP_STATUS = require('../../../constants/httpStatus');
const { getErrorStatus } = require('./errorStatus');
const { shouldFallback } = require('./fallbackPolicy');

function resolveErrorCode(status) {
  if (status === HTTP_STATUS.TOO_MANY_REQUESTS) return 'RATE_LIMIT';
  if (status === HTTP_STATUS.BAD_REQUEST) return 'INVALID_INPUT';
  if (status === HTTP_STATUS.UNAUTHORIZED || status === HTTP_STATUS.FORBIDDEN)
    return 'AUTH_REQUIRED';
  if (typeof status === 'number' && status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return 'BAD_GATEWAY';
  }
  return 'INTERNAL_ERROR';
}

function createProviderError(provider, operation, originalError) {
  const status = getErrorStatus(originalError);
  const message = `[${provider}] ${operation} failed: ${originalError?.message || 'Unknown error'}`;
  const baseDetails = { provider, operation };
  const code = originalError instanceof AppError ? originalError.code : resolveErrorCode(status);
  const statusCode =
    originalError instanceof AppError
      ? (originalError.statusCode ?? status)
      : typeof status === 'number'
        ? status
        : null;
  const details =
    originalError instanceof AppError ? { ...baseDetails, ...originalError.details } : baseDetails;

  const error = new AppError(message, code, statusCode, details);
  error.provider = provider;
  error.operation = operation;
  error.originalError = originalError;
  error.status = status ?? error.statusCode;
  error.shouldFallback = shouldFallback(originalError);
  if (originalError?.headers) {
    error.headers = originalError.headers;
  }
  if (originalError?.response) {
    error.response = originalError.response;
  }
  return error;
}

module.exports = {
  createProviderError,
};
