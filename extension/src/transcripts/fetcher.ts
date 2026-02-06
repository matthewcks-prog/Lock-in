import type { EnhancedAsyncFetcher } from '@core/transcripts/fetchers/types';
import { extractPanoptoInfoFromHtml } from '@core/transcripts';

interface HtmlFetchResult {
  html: string;
  finalUrl: string;
  redirected: boolean;
  status: number;
}

const TRANSCRIPT_FETCH_MAX_RETRIES = 2;
const TRANSCRIPT_FETCH_TIMEOUT_MS = 20000;

type NetworkRetry = {
  fetchWithRetry: (
    url: string,
    options?: RequestInit,
    config?: {
      maxRetries?: number;
      timeoutMs?: number;
      retryableStatuses?: number[];
      retryOnServerError?: boolean;
      retryOnNetworkError?: boolean;
      retryOnTimeout?: boolean;
      context?: string;
    },
  ) => Promise<Response>;
};

function getNetworkRetry(): NetworkRetry | null {
  if (typeof globalThis === 'undefined') return null;
  const root = globalThis as typeof globalThis & { LockInNetworkRetry?: NetworkRetry };
  return root.LockInNetworkRetry ?? null;
}

export class BackgroundFetcher implements EnhancedAsyncFetcher {
  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    const networkRetry = getNetworkRetry();
    if (!networkRetry?.fetchWithRetry) {
      throw new Error('Network retry utilities unavailable');
    }

    return networkRetry.fetchWithRetry(url, options, {
      maxRetries: TRANSCRIPT_FETCH_MAX_RETRIES,
      timeoutMs: TRANSCRIPT_FETCH_TIMEOUT_MS,
      context: 'transcript fetch',
    });
  }

  async fetchWithCredentials(url: string): Promise<string> {
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: '*/*',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  async fetchJson<T>(url: string): Promise<T> {
    const text = await this.fetchWithCredentials(url);
    return JSON.parse(text) as T;
  }

  async fetchHtmlWithRedirectInfo(url: string): Promise<HtmlFetchResult> {
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return {
      html,
      finalUrl: response.url,
      redirected: response.redirected,
      status: response.status,
    };
  }

  extractPanoptoInfoFromHtml(html: string, baseUrl: string) {
    return extractPanoptoInfoFromHtml(html, baseUrl);
  }
}
