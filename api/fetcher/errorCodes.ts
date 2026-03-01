import { ErrorCodes, type ErrorCode } from '../../core/errors';
import { HTTP_STATUS } from './constants';

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.values(ErrorCodes).includes(value as ErrorCode);
}

export function resolveErrorCode(status: number, code: string | undefined): ErrorCode {
  if (typeof code === 'string' && code.length > 0 && isErrorCode(code)) {
    return code;
  }

  switch (status) {
    case HTTP_STATUS.BAD_REQUEST:
      return ErrorCodes.VALIDATION_ERROR;
    case HTTP_STATUS.UNAUTHORIZED:
    case HTTP_STATUS.FORBIDDEN:
      return ErrorCodes.AUTH_REQUIRED;
    case HTTP_STATUS.NOT_FOUND:
      return ErrorCodes.NOT_FOUND;
    case HTTP_STATUS.REQUEST_TIMEOUT:
      return ErrorCodes.TIMEOUT;
    case HTTP_STATUS.CONFLICT:
      return ErrorCodes.CONFLICT;
    case HTTP_STATUS.TOO_MANY_REQUESTS:
      return ErrorCodes.RATE_LIMIT;
    case HTTP_STATUS.BAD_GATEWAY:
      return ErrorCodes.BAD_GATEWAY;
    case HTTP_STATUS.SERVICE_UNAVAILABLE:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    case HTTP_STATUS.GATEWAY_TIMEOUT:
      return ErrorCodes.TIMEOUT;
    default:
      if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        return ErrorCodes.INTERNAL_ERROR;
      }
      return ErrorCodes.INTERNAL_ERROR;
  }
}
