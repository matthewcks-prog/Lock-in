/**
 * Fetcher Interfaces
 *
 * Abstraction for network operations that can be implemented by:
 * - Chrome extension background script (with CORS bypass and credentials)
 * - Web app (standard fetch API)
 * - Node.js (server-side fetch)
 * - Test mocks
 *
 * No Chrome dependencies - pure interfaces.
 */

import type { PanoptoInfo } from '../providers/panopto/urlUtils';

/**
 * Base fetcher interface - all fetchers must implement
 */
export type AsyncFetcher = {
  /** Fetch HTML/text content with credentials included */
  fetchWithCredentials(url: string): Promise<string>;

  /** Fetch JSON with credentials included */
  fetchJson<T>(url: string): Promise<T>;
};

/**
 * Enhanced fetcher with optional capabilities for advanced features.
 * Fetchers can implement these if they support them (e.g., redirect tracking).
 */
export type EnhancedAsyncFetcher = AsyncFetcher & {
  /**
   * Fetch HTML with redirect tracking.
   * Returns the final URL after redirects, which is useful for dynamic URL discovery.
   * Background scripts can access response.url, content scripts cannot.
   */
  fetchHtmlWithRedirectInfo?(url: string): Promise<{
    html: string;
    finalUrl: string;
    redirected?: boolean;
    status?: number;
  }>;

  /**
   * Extract Panopto info from HTML content.
   * Used for dynamic URL discovery when captions aren't found in initial URLs.
   * This is a pure function but kept in fetcher interface for consistency.
   */
  extractPanoptoInfoFromHtml?(
    html: string,
    baseUrl: string,
  ): { info: PanoptoInfo; url?: string } | null;
};

export type RedirectSupportingFetcher = EnhancedAsyncFetcher & {
  fetchHtmlWithRedirectInfo: NonNullable<EnhancedAsyncFetcher['fetchHtmlWithRedirectInfo']>;
};

export type HtmlParsingFetcher = EnhancedAsyncFetcher & {
  extractPanoptoInfoFromHtml: NonNullable<EnhancedAsyncFetcher['extractPanoptoInfoFromHtml']>;
};

/**
 * Type guard to check if fetcher supports redirect tracking
 */
export function hasRedirectSupport(fetcher: AsyncFetcher): fetcher is RedirectSupportingFetcher {
  return (
    'fetchHtmlWithRedirectInfo' in fetcher &&
    typeof fetcher.fetchHtmlWithRedirectInfo === 'function'
  );
}

/**
 * Type guard to check if fetcher supports HTML parsing
 */
export function hasHtmlParsingSupport(fetcher: AsyncFetcher): fetcher is HtmlParsingFetcher {
  return (
    'extractPanoptoInfoFromHtml' in fetcher &&
    typeof fetcher.extractPanoptoInfoFromHtml === 'function'
  );
}
