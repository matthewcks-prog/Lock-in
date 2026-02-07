import type { AuthClient } from '../auth';
import { AppError, AuthError, ErrorCodes } from '../../core/errors';
import { HTTP_STATUS } from './constants';
import type { ApiRequestOptions } from './types';

export function createAbortError(): AppError {
  return new AppError('Request was aborted', ErrorCodes.ABORTED);
}

export function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw createAbortError();
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function isFormDataBody(body: unknown): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

export function resolveRequestUrl(backendUrl: string, endpoint: string): string {
  return endpoint.startsWith('http') ? endpoint : `${backendUrl}${endpoint}`;
}

export async function getAccessToken(
  authClient: AuthClient,
  signal?: AbortSignal,
): Promise<string> {
  ensureNotAborted(signal);
  const accessToken = await authClient.getValidAccessToken();
  if (accessToken === null || accessToken.length === 0) {
    throw new AuthError(
      'Please sign in via the Lock-in popup before using the assistant.',
      ErrorCodes.AUTH_REQUIRED,
    );
  }
  ensureNotAborted(signal);
  return accessToken;
}

export function buildRequestHeaders(
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

  if (typeof ifUnmodifiedSince === 'string' && ifUnmodifiedSince.length > 0) {
    headers['If-Unmodified-Since'] = ifUnmodifiedSince;
  }

  return {
    ...headers,
    ...(fetchOptions.headers ?? {}),
  };
}

export function shouldSignOut(response: Response): boolean {
  return response.status === HTTP_STATUS.UNAUTHORIZED || response.status === HTTP_STATUS.FORBIDDEN;
}
