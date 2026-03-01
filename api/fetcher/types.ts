import type { AuthClient } from '../auth';
import type { Logger } from '../../core/utils/logger';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
};

export type ApiRequestOptions = RequestInit & {
  signal?: AbortSignal;
  retry?: boolean;
  retryConfig?: Partial<RetryConfig>;
  ifUnmodifiedSince?: string;
  timeoutMs?: number;
};

export type ApiRequest = <T = unknown>(endpoint: string, options?: ApiRequestOptions) => Promise<T>;

export type FetcherConfig = {
  backendUrl: string;
  authClient: AuthClient;
  fetcher?: FetchLike;
  logger?: Logger;
};

export type FetcherClient = {
  apiRequest: ApiRequest;
  getBackendUrl: () => string;
};
