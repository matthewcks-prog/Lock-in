import type { AuthClient } from '../auth';
import { AppError, ErrorCodes, NetworkError, TimeoutError } from '../../core/errors';
import type { Logger } from '../../core/utils/logger';
import { withTimeout } from '../../core/utils/timeout';
import { maybeThrowConflictError } from './conflict';
import { createApiError } from './errors';
import { parseJsonResponse } from './responseParser';
import { calculateRetryDelay, sleep, shouldRetryResponse } from './retry';
import { createAbortError, ensureNotAborted, isAbortError, shouldSignOut } from './requestUtils';
import type { FetchLike, RetryConfig } from './types';

type RequestContext = {
  fetcher: FetchLike;
  url: string;
  requestOptions: RequestInit;
  retryConfig: RetryConfig;
  retryEnabled: boolean;
  timeoutMs: number;
  endpoint: string;
  signal?: AbortSignal;
  authClient: AuthClient;
  logger: Logger;
};

type AttemptResult<T> = { type: 'success'; data: T } | { type: 'retry'; error: AppError };

type NetworkFailure = {
  error: AppError;
  retry: boolean;
};

type NetworkFailureContext = {
  signal?: AbortSignal;
  retryEnabled: boolean;
  attempt: number;
  retryConfig: RetryConfig;
};

async function waitBeforeRetry(
  attempt: number,
  retryConfig: RetryConfig,
  logger: Logger,
  signal?: AbortSignal,
): Promise<void> {
  if (attempt === 0) return;
  const delay = calculateRetryDelay(attempt - 1, retryConfig);
  logger.debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
  await sleep(delay);
  ensureNotAborted(signal);
}

async function executeFetch(context: RequestContext): Promise<Response> {
  const operationName = `${context.requestOptions.method ?? 'GET'} ${context.endpoint}`;
  return withTimeout(
    context.fetcher(context.url, context.requestOptions),
    context.timeoutMs,
    operationName,
  );
}

function resolveNetworkFailure(error: unknown, context: NetworkFailureContext): NetworkFailure {
  if (context.signal?.aborted === true || isAbortError(error)) {
    return { error: createAbortError(), retry: false };
  }
  if (error instanceof TimeoutError) {
    return {
      error,
      retry: context.retryEnabled && context.attempt < context.retryConfig.maxRetries,
    };
  }
  const cause = error instanceof Error ? error : undefined;
  const options: { cause?: Error } = {};
  if (cause !== undefined) {
    options.cause = cause;
  }
  return {
    error: new NetworkError('Unable to reach Lock-in. Please check your connection.', options),
    retry: context.retryEnabled && context.attempt < context.retryConfig.maxRetries,
  };
}

async function handleResponse<T>(
  response: Response,
  context: RequestContext,
  attempt: number,
): Promise<AttemptResult<T>> {
  await maybeThrowConflictError(response);
  if (shouldRetryResponse(response, context.retryConfig, context.retryEnabled, attempt)) {
    return { type: 'retry', error: await createApiError(response) };
  }
  if (shouldSignOut(response)) {
    await context.authClient.signOut().catch(() => {});
  }
  if (!response.ok) {
    throw await createApiError(response);
  }
  const data = await parseJsonResponse<T>(response);
  return { type: 'success', data };
}

async function attemptRequest<T>(
  context: RequestContext,
  attempt: number,
): Promise<AttemptResult<T>> {
  await waitBeforeRetry(attempt, context.retryConfig, context.logger, context.signal);
  try {
    const response = await executeFetch(context);
    return await handleResponse<T>(response, context, attempt);
  } catch (error) {
    if (
      error instanceof AppError &&
      !(error instanceof TimeoutError) &&
      !(error instanceof NetworkError)
    ) {
      throw error;
    }
    const failureContext: NetworkFailureContext = {
      retryEnabled: context.retryEnabled,
      attempt,
      retryConfig: context.retryConfig,
    };
    if (context.signal !== undefined) {
      failureContext.signal = context.signal;
    }
    const failure = resolveNetworkFailure(error, failureContext);
    if (failure.retry) {
      return { type: 'retry', error: failure.error };
    }
    throw failure.error;
  }
}

export async function performRequestWithRetry<T>(context: RequestContext): Promise<T> {
  let lastError: AppError | null = null;
  const maxAttempts = context.retryEnabled ? context.retryConfig.maxRetries : 0;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    ensureNotAborted(context.signal);
    const result = await attemptRequest<T>(context, attempt);
    if (result.type === 'success') {
      return result.data;
    }
    lastError = result.error;
  }
  if (lastError !== null) {
    throw lastError;
  }
  throw new AppError('Request failed after retries', ErrorCodes.INTERNAL_ERROR);
}
