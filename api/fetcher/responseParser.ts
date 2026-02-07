import { AppError, ErrorCodes } from '../../core/errors';
import { HTTP_STATUS } from './constants';
import { resolveErrorCode } from './errorCodes';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function firstString(candidates: Array<unknown>, fallback: string): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return fallback;
}

export function buildAppErrorFromPayload(status: number, payload: unknown): AppError | null {
  if (!isRecord(payload) || payload['success'] !== false) {
    return null;
  }
  const errorValue = payload['error'];
  const errorDetails = isRecord(errorValue) ? errorValue : undefined;
  const message = firstString(
    [typeof errorValue === 'string' ? errorValue : undefined, errorDetails?.['message']],
    'Request failed',
  );
  const errorCode = isRecord(errorValue) ? errorValue['code'] : undefined;
  const options: { status?: number; details?: Record<string, unknown> } = { status };
  if (errorDetails !== undefined) {
    options.details = errorDetails;
  }
  return new AppError(
    message,
    resolveErrorCode(status, typeof errorCode === 'string' ? errorCode : undefined),
    options,
  );
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    if (response.status === HTTP_STATUS.NO_CONTENT) {
      return undefined as T;
    }

    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    const hasJsonContentType =
      typeof contentType === 'string' && contentType.includes('application/json');

    if (contentLength === '0' || !hasJsonContentType) {
      return undefined as T;
    }

    const data: unknown = await response.json();
    const appError = buildAppErrorFromPayload(response.status, data);
    if (appError !== null) {
      throw appError;
    }

    return data as T;
  } catch (parseError) {
    if (parseError instanceof AppError) {
      throw parseError;
    }
    const cause = parseError instanceof Error ? parseError : undefined;
    const options: { cause?: Error } = {};
    if (cause !== undefined) {
      options.cause = cause;
    }
    throw new AppError('Failed to parse API response', ErrorCodes.PARSE_ERROR, options);
  }
}
