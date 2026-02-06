/**
 * JWKS (JSON Web Key Set) Provider
 *
 * Fetches and caches public keys from a JWKS endpoint for JWT verification.
 * Supports automatic key rotation and cache invalidation.
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for fetching and caching JWKS
 * - Open/Closed: Cache strategy can be extended without modifying core logic
 * - Dependency Inversion: Depends on fetch abstraction, not concrete implementation
 *
 * Security Considerations:
 * - Keys are cached to reduce latency and prevent JWKS endpoint DoS
 * - Cache TTL is configurable to balance freshness vs performance
 * - Supports multiple key IDs (kid) for key rotation
 *
 * @module services/auth/jwksProvider
 */

const { logger } = require('../../observability');
const { fetchWithRetry } = require('../../utils/networkRetry');

/**
 * Default cache TTL in milliseconds (10 minutes)
 * Supabase Edge caches JWKS for 10 minutes, so we match that
 */
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Minimum cache TTL (1 minute) - prevents excessive requests
 */
const MIN_CACHE_TTL_MS = 60 * 1000;

/**
 * Maximum cache TTL (1 hour) - ensures keys stay relatively fresh
 */
const MAX_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * JWKS Provider
 *
 * Manages fetching and caching of JSON Web Key Sets from remote endpoints.
 */
class JwksProvider {
  /**
   * Create a new JwksProvider
   *
   * @param {Object} options - Configuration options
   * @param {string} options.jwksUri - The JWKS endpoint URL
   * @param {number} [options.cacheTtlMs=600000] - Cache TTL in milliseconds
   * @param {function} [options.fetcher] - Custom fetch function for testing
   * @param {number} [options.requestTimeoutMs=10000] - Request timeout in ms
   */
  constructor({
    jwksUri,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    fetcher = null,
    requestTimeoutMs = 10000,
  } = {}) {
    if (!jwksUri || typeof jwksUri !== 'string') {
      throw new Error('JwksProvider requires a valid jwksUri');
    }

    this._jwksUri = jwksUri;
    this._cacheTtlMs = Math.max(MIN_CACHE_TTL_MS, Math.min(cacheTtlMs, MAX_CACHE_TTL_MS));
    this._fetcher = fetcher || this._defaultFetcher.bind(this);
    this._requestTimeoutMs = requestTimeoutMs;

    // Cache state
    this._cache = null;
    this._cacheExpiry = 0;
    this._fetchPromise = null; // Prevents thundering herd

    logger.debug('[JwksProvider] Initialized', {
      jwksUri: this._jwksUri,
      cacheTtlMs: this._cacheTtlMs,
    });
  }

  /**
   * Default fetcher using global fetch
   *
   * @param {string} url - URL to fetch
   * @returns {Promise<Object>} Parsed JSON response
   */
  async _defaultFetcher(url) {
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: 'application/json',
        },
      },
      {
        maxRetries: 2,
        timeoutMs: this._requestTimeoutMs,
        retryableStatuses: [429, 502, 503, 504],
        retryOnServerError: true,
        onRetry: (info) => {
          logger.warn('[JwksProvider] Retry JWKS fetch', {
            attempt: info.attempt,
            delayMs: info.delayMs,
            status: info.status,
          });
        },
      },
    );

    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get the JWKS, using cache if available
   *
   * @param {boolean} [forceRefresh=false] - Force a fresh fetch
   * @returns {Promise<Object>} The JWKS object with keys array
   */
  async getKeys(forceRefresh = false) {
    const now = Date.now();

    // Return cached value if valid and not forcing refresh
    if (!forceRefresh && this._cache && now < this._cacheExpiry) {
      logger.debug('[JwksProvider] Returning cached JWKS');
      return this._cache;
    }

    // Prevent thundering herd - if a fetch is in progress, wait for it
    if (this._fetchPromise) {
      logger.debug('[JwksProvider] Waiting for in-progress fetch');
      return this._fetchPromise;
    }

    // Perform the fetch
    this._fetchPromise = this._fetchKeys();

    try {
      const result = await this._fetchPromise;
      return result;
    } finally {
      this._fetchPromise = null;
    }
  }

  /**
   * Fetch keys from the JWKS endpoint
   *
   * @returns {Promise<Object>} The JWKS object
   */
  async _fetchKeys() {
    logger.debug('[JwksProvider] Fetching JWKS from', { uri: this._jwksUri });

    try {
      const jwks = await this._fetcher(this._jwksUri);

      // Validate JWKS structure
      if (!jwks || !Array.isArray(jwks.keys)) {
        throw new Error('Invalid JWKS format: missing keys array');
      }

      // Update cache
      this._cache = jwks;
      this._cacheExpiry = Date.now() + this._cacheTtlMs;

      logger.debug('[JwksProvider] JWKS fetched and cached', {
        keyCount: jwks.keys.length,
        keyIds: jwks.keys.map((k) => k.kid).filter(Boolean),
      });

      return jwks;
    } catch (error) {
      logger.error('[JwksProvider] Failed to fetch JWKS:', { error: error.message });

      // If we have stale cache, use it as fallback
      if (this._cache) {
        logger.warn('[JwksProvider] Using stale cache as fallback');
        return this._cache;
      }

      throw error;
    }
  }

  /**
   * Get a specific key by key ID (kid)
   *
   * @param {string} kid - The key ID to find
   * @returns {Promise<Object|null>} The JWK or null if not found
   */
  async getKeyById(kid) {
    const jwks = await this.getKeys();
    const key = jwks.keys.find((k) => k.kid === kid);

    if (!key) {
      logger.debug('[JwksProvider] Key not found, refreshing cache', { kid });

      // Key not found - try refreshing in case of key rotation
      const refreshedJwks = await this.getKeys(true);
      return refreshedJwks.keys.find((k) => k.kid === kid) || null;
    }

    return key;
  }

  /**
   * Get the first available signing key
   *
   * Useful when tokens don't include a kid header
   *
   * @returns {Promise<Object|null>} The first JWK or null
   */
  async getFirstKey() {
    const jwks = await this.getKeys();
    return jwks.keys[0] || null;
  }

  /**
   * Clear the cache, forcing a fresh fetch on next request
   */
  clearCache() {
    this._cache = null;
    this._cacheExpiry = 0;
    logger.debug('[JwksProvider] Cache cleared');
  }

  /**
   * Get cache status for monitoring/debugging
   *
   * @returns {Object} Cache status info
   */
  getCacheStatus() {
    const now = Date.now();
    return {
      hasCachedKeys: Boolean(this._cache),
      keyCount: this._cache?.keys?.length || 0,
      isExpired: now >= this._cacheExpiry,
      expiresIn: Math.max(0, this._cacheExpiry - now),
      ttlMs: this._cacheTtlMs,
    };
  }
}

module.exports = { JwksProvider };
