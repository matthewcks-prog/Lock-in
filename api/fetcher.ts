import type { AuthClient } from './auth';
import {
  AppError,
  AuthError,
  ConflictError,
  ErrorCodes,
  type ErrorCode,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../core/errors';
import { createLogger, type Logger } from '../core/utils/logger';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatuses: [429, 502, 503, 504],
};

function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * (Math.random() * 0.3);
  return Math.floor(cappedDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.values(ErrorCodes).includes(value as ErrorCode);
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (!isRecord(body)) {
    return fallback;
  }

  const errorValue = body.error;
  if (isRecord(errorValue) && typeof errorValue.message === 'string') {
    return errorValue.message;
  }

  if (typeof errorValue === 'string') {
    return errorValue;
  }

  if (typeof body.message === 'string') {
    return body.message;
  }

  return fallback;
}

function extractErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const errorValue = body.error;
  if (isRecord(errorValue) && typeof errorValue.code === 'string') {
    return errorValue.code;
  }

  if (typeof body.code === 'string') {
    return body.code;
  }

  return undefined;
}

function parseRetryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;

  const seconds = Number(value);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function resolveErrorCode(status: number, code: string | undefined): ErrorCode {
  if (code && isErrorCode(code)) {
    return code;
  }

  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
    case 403:
      return ErrorCodes.AUTH_REQUIRED;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 408:
      return ErrorCodes.TIMEOUT;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMIT;
    case 502:
      return ErrorCodes.BAD_GATEWAY;
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    case 504:
      return ErrorCodes.TIMEOUT;
    default:
      if (status >= 500) {
        return ErrorCodes.INTERNAL_ERROR;
      }
      return ErrorCodes.INTERNAL_ERROR;
  }
}

function createAbortError(): AppError {
  return new AppError('Request was aborted', ErrorCodes.ABORTED);
}

export interface ApiRequestOptions extends RequestInit {
  signal?: AbortSignal;
  retry?: boolean;
  retryConfig?: Partial<RetryConfig>;
  ifUnmodifiedSince?: string;
}

async function createApiError(response: Response, originalError?: Error): Promise<AppError> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    try {
      const text = await response.text();
      body = text || null;
    } catch {
      body = null;
    }
  }

  const message = extractErrorMessage(body, 'API request failed');
  const code = resolveErrorCode(response.status, extractErrorCode(body));
  const details = isRecord(body) ? body : body ? { body } : undefined;
  const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response) : undefined;
  const isRetryable =
    response.status >= 500 ||
    code === ErrorCodes.TIMEOUT ||
    code === ErrorCodes.SERVICE_UNAVAILABLE ||
    code === ErrorCodes.BAD_GATEWAY;

  switch (code) {
    case ErrorCodes.AUTH_REQUIRED:
    case ErrorCodes.INVALID_TOKEN:
    case ErrorCodes.SESSION_EXPIRED:
      return new AuthError(message, code, {
        status: response.status,
        details,
        cause: originalError,
      });
    case ErrorCodes.RATE_LIMIT:
      return new RateLimitError(message, retryAfterMs, { cause: originalError });
    case ErrorCodes.VALIDATION_ERROR:
      return new ValidationError(message, undefined, { details, cause: originalError });
    case ErrorCodes.NOT_FOUND:
      return new NotFoundError(message, undefined, undefined, { cause: originalError });
    case ErrorCodes.CONFLICT:
      return new ConflictError(message, undefined, { cause: originalError });
    default:
      return new AppError(message, code, {
        status: response.status,
        details,
        isRetryable,
        cause: originalError,
      });
  }
}

export type ApiRequest = <T = unknown>(endpoint: string, options?: ApiRequestOptions) => Promise<T>;
export { ConflictError };

export interface FetcherConfig {
  backendUrl: string;
  authClient: AuthClient;
  fetcher?: FetchLike;
  logger?: Logger;
}

function resolveFetch(fetcher?: FetchLike): FetchLike {
  const resolved = fetcher ?? globalThis.fetch;
  if (typeof resolved !== 'function') {
    throw new Error('Fetch implementation is required. Provide fetcher in createFetcher config.');
  }
  return resolved;
}

export function createFetcher(config: FetcherConfig) {
  const { backendUrl, authClient } = config;
  const clientConfig = { backendUrl };
  const fetcher = resolveFetch(config.fetcher);
  const logger = config.logger ?? createLogger('ApiFetcher');

  async function apiRequest<T = unknown>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const {
      retry = true,
      retryConfig: customRetryConfig,
      ifUnmodifiedSince,
      ...fetchOptions
    } = options;

    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
    const url = endpoint.startsWith('http') ? endpoint : `${backendUrl}${endpoint}`;

    if (fetchOptions.signal?.aborted) {
      throw createAbortError();
    }

    const accessToken = await authClient.getValidAccessToken();
    if (!accessToken) {
      throw new AuthError(
        'Please sign in via the Lock-in popup before using the assistant.',
        ErrorCodes.AUTH_REQUIRED,
      );
    }

    if (fetchOptions.signal?.aborted) {
      throw createAbortError();
    }

    const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(ifUnmodifiedSince ? { 'If-Unmodified-Since': ifUnmodifiedSince } : {}),
      ...(fetchOptions.headers || {}),
    };

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal,
    };

    let lastError: AppError | null = null;
    for (let attempt = 0; attempt <= (retry ? retryConfig.maxRetries : 0); attempt++) {
      if (fetchOptions.signal?.aborted) {
        throw createAbortError();
      }

      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt - 1, retryConfig);
        logger.debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await sleep(delay);

        if (fetchOptions.signal?.aborted) {
          throw createAbortError();
        }
      }

      let response: Response;
      try {
        response = await fetcher(url, requestOptions);
      } catch (networkError) {
        if (fetchOptions.signal?.aborted) {
          throw createAbortError();
        }

        if (networkError instanceof Error && networkError.name === 'AbortError') {
          throw createAbortError();
        }

        const cause = networkError instanceof Error ? networkError : undefined;
        lastError = new NetworkError('Unable to reach Lock-in. Please check your connection.', {
          cause,
        });

        if (retry && attempt < retryConfig.maxRetries) {
          continue;
        }
        throw lastError;
      }

      if (response.status === 409) {
        let serverVersion: string | undefined;
        try {
          const body: unknown = await response.json();
          if (isRecord(body)) {
            if (typeof body.updatedAt === 'string') {
              serverVersion = body.updatedAt;
            } else if (typeof body.updated_at === 'string') {
              serverVersion = body.updated_at;
            }
          }
        } catch {
          // ignore parse errors
        }
        throw new ConflictError(
          'Note was modified by another session. Please refresh and try again.',
          serverVersion,
        );
      }

      if (
        retry &&
        retryConfig.retryableStatuses.includes(response.status) &&
        attempt < retryConfig.maxRetries
      ) {
        lastError = await createApiError(response);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        await authClient.signOut().catch(() => {});
      }

      if (!response.ok) {
        throw await createApiError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      try {
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');

        if (contentLength === '0' || !contentType?.includes('application/json')) {
          return undefined as T;
        }

        const data: unknown = await response.json();
        if (isRecord(data) && data.success === false) {
          const errorValue = data.error;
          const errorDetails = isRecord(errorValue) ? errorValue : undefined;
          const message =
            (typeof errorValue === 'string' && errorValue) ||
            (errorDetails && typeof errorDetails.message === 'string' && errorDetails.message) ||
            'Request failed';
          const errorCode = isRecord(errorValue) ? errorValue.code : undefined;
          throw new AppError(
            message,
            resolveErrorCode(
              response.status,
              typeof errorCode === 'string' ? errorCode : undefined,
            ),
            { status: response.status, details: errorDetails },
          );
        }
        return data as T;
      } catch (parseError) {
        if (parseError instanceof AppError) {
          throw parseError;
        }
        const cause = parseError instanceof Error ? parseError : undefined;
        throw new AppError('Failed to parse API response', ErrorCodes.PARSE_ERROR, { cause });
      }
    }

    throw lastError || new AppError('Request failed after retries', ErrorCodes.INTERNAL_ERROR);
  }

  function getBackendUrl(): string {
    return clientConfig.backendUrl;
  }

  return {
    apiRequest,
    getBackendUrl,
  };
}
