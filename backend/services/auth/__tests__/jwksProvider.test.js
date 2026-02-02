/**
 * Unit Tests for JWKS Provider
 *
 * Tests the JSON Web Key Set fetching and caching functionality.
 * Uses a mock fetcher to avoid network calls.
 *
 * @module services/auth/__tests__/jwksProvider.test
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JwksProvider } = require('../jwksProvider');

describe('JwksProvider', () => {
  // Sample JWKS for testing
  const sampleJwks = {
    keys: [
      {
        kid: 'key-1',
        alg: 'ES256',
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x-coordinate',
        y: 'test-y-coordinate',
      },
      {
        kid: 'key-2',
        alg: 'RS256',
        kty: 'RSA',
        n: 'test-modulus',
        e: 'AQAB',
      },
    ],
  };

  describe('constructor', () => {
    it('should throw if jwksUri is not provided', () => {
      assert.throws(() => new JwksProvider({}), /requires a valid jwksUri/);
    });

    it('should throw if jwksUri is empty string', () => {
      assert.throws(() => new JwksProvider({ jwksUri: '' }), /requires a valid jwksUri/);
    });

    it('should accept valid jwksUri', () => {
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
      });
      assert.ok(provider);
    });

    it('should enforce minimum cache TTL', () => {
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        cacheTtlMs: 1000, // 1 second (below minimum)
      });
      const status = provider.getCacheStatus();
      assert.strictEqual(status.ttlMs, 60 * 1000); // Should be clamped to minimum
    });

    it('should enforce maximum cache TTL', () => {
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours (above maximum)
      });
      const status = provider.getCacheStatus();
      assert.strictEqual(status.ttlMs, 60 * 60 * 1000); // Should be clamped to maximum
    });
  });

  describe('getKeys', () => {
    it('should fetch and return JWKS', async () => {
      const mockFetcher = async () => sampleJwks;
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      const result = await provider.getKeys();
      assert.deepStrictEqual(result, sampleJwks);
    });

    it('should cache results', async () => {
      let fetchCount = 0;
      const mockFetcher = async () => {
        fetchCount++;
        return sampleJwks;
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      await provider.getKeys();
      await provider.getKeys();
      await provider.getKeys();

      assert.strictEqual(fetchCount, 1); // Should only fetch once
    });

    it('should force refresh when requested', async () => {
      let fetchCount = 0;
      const mockFetcher = async () => {
        fetchCount++;
        return sampleJwks;
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      await provider.getKeys();
      await provider.getKeys(true); // Force refresh

      assert.strictEqual(fetchCount, 2);
    });

    it('should throw on invalid JWKS format', async () => {
      const mockFetcher = async () => ({ invalid: 'format' });
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      await assert.rejects(provider.getKeys(), /Invalid JWKS format/);
    });

    it('should use stale cache as fallback on fetch error', async () => {
      let shouldFail = false;
      const mockFetcher = async () => {
        if (shouldFail) {
          throw new Error('Network error');
        }
        return sampleJwks;
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      // First successful fetch
      await provider.getKeys();

      // Simulate cache expiry and network failure
      shouldFail = true;
      provider._cacheExpiry = 0; // Force expiry

      // Should return stale cache
      const result = await provider.getKeys();
      assert.deepStrictEqual(result, sampleJwks);
    });

    it('should throw if no cache and fetch fails', async () => {
      const mockFetcher = async () => {
        throw new Error('Network error');
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      await assert.rejects(provider.getKeys(), /Network error/);
    });

    it('should prevent thundering herd with concurrent requests', async () => {
      let fetchCount = 0;
      const mockFetcher = async () => {
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return sampleJwks;
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      // Make concurrent requests
      const results = await Promise.all([
        provider.getKeys(),
        provider.getKeys(),
        provider.getKeys(),
      ]);

      assert.strictEqual(fetchCount, 1); // Should only fetch once
      results.forEach((result) => {
        assert.deepStrictEqual(result, sampleJwks);
      });
    });
  });

  describe('getKeyById', () => {
    it('should return matching key', async () => {
      const mockFetcher = async () => sampleJwks;
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      const key = await provider.getKeyById('key-1');
      assert.strictEqual(key.kid, 'key-1');
      assert.strictEqual(key.alg, 'ES256');
    });

    it('should return null for non-existent key', async () => {
      const mockFetcher = async () => sampleJwks;
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      const key = await provider.getKeyById('non-existent');
      assert.strictEqual(key, null);
    });

    it('should refresh cache and retry if key not found', async () => {
      let fetchCount = 0;
      const mockFetcher = async () => {
        fetchCount++;
        return sampleJwks;
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      await provider.getKeyById('non-existent');
      assert.strictEqual(fetchCount, 2); // Initial fetch + refresh attempt
    });
  });

  describe('getFirstKey', () => {
    it('should return first key', async () => {
      const mockFetcher = async () => sampleJwks;
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      const key = await provider.getFirstKey();
      assert.strictEqual(key.kid, 'key-1');
    });

    it('should return null for empty keys array', async () => {
      const mockFetcher = async () => ({ keys: [] });
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      const key = await provider.getFirstKey();
      assert.strictEqual(key, null);
    });
  });

  describe('clearCache', () => {
    it('should clear cached keys', async () => {
      let fetchCount = 0;
      const mockFetcher = async () => {
        fetchCount++;
        return sampleJwks;
      };
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      await provider.getKeys();
      provider.clearCache();
      await provider.getKeys();

      assert.strictEqual(fetchCount, 2);
    });
  });

  describe('getCacheStatus', () => {
    it('should return cache status', async () => {
      const mockFetcher = async () => sampleJwks;
      const provider = new JwksProvider({
        jwksUri: 'https://example.com/.well-known/jwks.json',
        fetcher: mockFetcher,
      });

      let status = provider.getCacheStatus();
      assert.strictEqual(status.hasCachedKeys, false);
      assert.strictEqual(status.keyCount, 0);
      assert.strictEqual(status.isExpired, true);

      await provider.getKeys();

      status = provider.getCacheStatus();
      assert.strictEqual(status.hasCachedKeys, true);
      assert.strictEqual(status.keyCount, 2);
      assert.strictEqual(status.isExpired, false);
      assert.ok(status.expiresIn > 0);
    });
  });
});
