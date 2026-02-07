import { createLogger } from '../core/utils/logger';
import { DEFAULT_TIMEOUT_MS } from './fetcher/constants';
import { performRequestWithRetry } from './fetcher/requestExecutor';
import { resolveFetch, resolveRetryConfig } from './fetcher/setup';
import {
  buildRequestHeaders,
  ensureNotAborted,
  getAccessToken,
  resolveRequestUrl,
} from './fetcher/requestUtils';
import type {
  ApiRequest,
  ApiRequestOptions,
  FetcherClient,
  FetcherConfig,
  FetchLike,
  RetryConfig,
} from './fetcher/types';
export function createFetcher(config: FetcherConfig): FetcherClient {
  const { backendUrl, authClient } = config;
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
      timeoutMs,
      ...fetchOptions
    } = options;
    const retryConfig = resolveRetryConfig(customRetryConfig);
    const resolvedTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const url = resolveRequestUrl(backendUrl, endpoint);

    ensureNotAborted(signal);
    const accessToken = await getAccessToken(authClient, signal);
    const headers = buildRequestHeaders(accessToken, fetchOptions, ifUnmodifiedSince);

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };
    if (signal !== undefined) {
      requestOptions.signal = signal;
    }

    const requestContext = {
      fetcher,
      url,
      requestOptions,
      retryConfig,
      retryEnabled: retry,
      timeoutMs: resolvedTimeoutMs,
      endpoint,
      authClient,
      logger,
      ...(signal !== undefined ? { signal } : {}),
    };
    return performRequestWithRetry<T>(requestContext);
  }

  return {
    apiRequest,
    getBackendUrl: () => backendUrl,
  };
}
export { ConflictError } from '../core/errors';
export type { ApiRequest, ApiRequestOptions, FetchLike, FetcherClient, FetcherConfig, RetryConfig };
