import { DEFAULT_RETRY_CONFIG } from './constants';
import type { FetchLike, RetryConfig } from './types';

export function resolveFetch(fetcher?: FetchLike): FetchLike {
  const resolved = fetcher ?? globalThis.fetch;
  if (typeof resolved !== 'function') {
    throw new Error('Fetch implementation is required. Provide fetcher in createFetcher config.');
  }
  if (resolved === globalThis.fetch) {
    return globalThis.fetch.bind(globalThis);
  }
  return resolved;
}

export function resolveRetryConfig(customRetryConfig?: Partial<RetryConfig>): RetryConfig {
  return { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
}
