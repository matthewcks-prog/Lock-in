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

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isFormDataBody(body: unknown): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function resolveRequestUrl(backendUrl: string, endpoint: string): string {
  return endpoint.startsWith('http') ? endpoint : `${backendUrl}${endpoint}`;
}

async function getAccessToken(authClient: AuthClient, signal?: AbortSignal): Promise<string> {
  ensureNotAborted(signal);
  const accessToken = await authClient.getValidAccessToken();
  if (!accessToken) {
    throw new AuthError(
      'Please sign in via the Lock-in popup before using the assistant.',
      ErrorCodes.AUTH_REQUIRED,
    );
  }
  ensureNotAborted(signal);
  return accessToken;
}

function buildRequestHeaders(
  accessToken: string,
  fetchOptions: ApiRequestOptions,
  ifUnmodifiedSince?: string,
): HeadersInit {
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (!isFormDataBody(fetchOptions.body)) {
    headers['Content-Type'] = 'application/json';
  }

  if (ifUnmodifiedSince) {
    headers['If-Unmodified-Since'] = ifUnmodifiedSince;
  }

  return {
    ...headers,
    ...(fetchOptions.headers || {}),
  };
}

async function extractConflictVersion(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      if (typeof body['updatedAt'] === 'string') {
        return body['updatedAt'];
      }
      if (typeof body['updated_at'] === 'string') {
        return body['updated_at'];
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function maybeThrowConflictError(response: Response): Promise<void> {
  if (response.status !== 409) return;
  const serverVersion = await extractConflictVersion(response);
  throw new ConflictError(
    'Note was modified by another session. Please refresh and try again.',
    serverVersion,
  );
}

function shouldRetryResponse(
  response: Response,
  retryConfig: RetryConfig,
  retryEnabled: boolean,
  attempt: number,
): boolean {
  return (
    retryEnabled &&
    retryConfig.retryableStatuses.includes(response.status) &&
    attempt < retryConfig.maxRetries
  );
}

function shouldSignOut(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function firstString(candidates: Array<unknown>, fallback: string): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) {
      return candidate;
    }
  }
  return fallback;
}

function buildAppErrorFromPayload(status: number, payload: unknown): AppError | null {
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
  if (errorDetails) {
    options.details = errorDetails;
  }
  return new AppError(
    message,
    resolveErrorCode(status, typeof errorCode === 'string' ? errorCode : undefined),
    options,
  );
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    if (response.status === 204) {
      return undefined as T;
    }

    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');

    if (contentLength === '0' || !contentType?.includes('application/json')) {
      return undefined as T;
    }

    const data: unknown = await response.json();
    const appError = buildAppErrorFromPayload(response.status, data);
    if (appError) {
      throw appError;
    }

    return data as T;
  } catch (parseError) {
    if (parseError instanceof AppError) {
      throw parseError;
    }
    const cause = parseError instanceof Error ? parseError : undefined;
    const options: { cause?: Error } = {};
    if (cause) {
      options.cause = cause;
    }
    throw new AppError('Failed to parse API response', ErrorCodes.PARSE_ERROR, options);
  }
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
  const baseOptions: { details?: Record<string, unknown>; cause?: Error } = {};
  if (details) {
    baseOptions.details = details;
  }
  if (originalError) {
    baseOptions.cause = originalError;
  }

  switch (code) {
    case ErrorCodes.AUTH_REQUIRED:
    case ErrorCodes.INVALID_TOKEN:
    case ErrorCodes.SESSION_EXPIRED:
      return new AuthError(message, code, { status: response.status, ...baseOptions });
    case ErrorCodes.RATE_LIMIT:
      return new RateLimitError(message, retryAfterMs, { ...baseOptions });
    case ErrorCodes.VALIDATION_ERROR:
      return new ValidationError(message, undefined, { ...baseOptions });
    case ErrorCodes.NOT_FOUND:
      return new NotFoundError(message, undefined, undefined, { ...baseOptions });
    case ErrorCodes.CONFLICT:
      return new ConflictError(message, undefined, { ...baseOptions });
    default:
      return new AppError(message, code, { status: response.status, isRetryable, ...baseOptions });
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
      signal,
      ...fetchOptions
    } = options;

    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
    const url = resolveRequestUrl(backendUrl, endpoint);
    ensureNotAborted(signal);
    const accessToken = await getAccessToken(authClient, signal);
    const headers = buildRequestHeaders(accessToken, fetchOptions, ifUnmodifiedSince);

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };
    if (signal) {
      requestOptions.signal = signal;
    }

    let lastError: AppError | null = null;
    const maxAttempts = retry ? retryConfig.maxRetries : 0;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      ensureNotAborted(signal);

      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt - 1, retryConfig);
        logger.debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await sleep(delay);

        ensureNotAborted(signal);
      }

      let response: Response;
      try {
        response = await fetcher(url, requestOptions);
      } catch (networkError) {
        if (signal?.aborted || isAbortError(networkError)) {
          throw createAbortError();
        }

        const cause = networkError instanceof Error ? networkError : undefined;
        const options: { cause?: Error } = {};
        if (cause) {
          options.cause = cause;
        }
        lastError = new NetworkError(
          'Unable to reach Lock-in. Please check your connection.',
          options,
        );

        if (retry && attempt < retryConfig.maxRetries) {
          continue;
        }
        throw lastError;
      }

      await maybeThrowConflictError(response);

      if (shouldRetryResponse(response, retryConfig, retry, attempt)) {
        lastError = await createApiError(response);
        continue;
      }

      if (shouldSignOut(response)) {
        await authClient.signOut().catch(() => {});
      }

      if (!response.ok) {
        throw await createApiError(response);
      }

      return await parseJsonResponse<T>(response);
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
