/**
 * Unit Tests for JWT Verifier Strategies
 *
 * Tests individual verification strategies in isolation.
 *
 * @module services/auth/__tests__/strategies.test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const {
  SymmetricVerifierStrategy,
  SupabaseSdkVerifierStrategy,
  JwksVerifierStrategy,
} = require('../strategies');

describe('SymmetricVerifierStrategy', () => {
  const secret = 'super-secret-key-with-at-least-32-chars-for-hs256';

  describe('constructor', () => {
    it('should create strategy without secret', () => {
      const strategy = new SymmetricVerifierStrategy({});
      assert.strictEqual(strategy.name, 'symmetric');
    });

    it('should create strategy with secret', () => {
      const strategy = new SymmetricVerifierStrategy({ secret });
      assert.strictEqual(strategy.isAvailable(), true);
    });
  });

  describe('isAvailable', () => {
    it('should return false when no secret', () => {
      const strategy = new SymmetricVerifierStrategy({});
      assert.strictEqual(strategy.isAvailable(), false);
    });

    it('should return true when secret provided', () => {
      const strategy = new SymmetricVerifierStrategy({ secret });
      assert.strictEqual(strategy.isAvailable(), true);
    });
  });

  describe('verify', () => {
    it('should return invalid when no secret configured', async () => {
      const strategy = new SymmetricVerifierStrategy({});
      const result = await strategy.verify('any-token');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('No symmetric secret configured'));
    });

    it('should verify valid HS256 token', async () => {
      const strategy = new SymmetricVerifierStrategy({ secret });

      const token = jwt.sign(
        { sub: 'user-123', email: 'test@example.com', role: 'authenticated' },
        secret,
        { algorithm: 'HS256' },
      );

      const result = await strategy.verify(token);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.payload.id, 'user-123');
      assert.strictEqual(result.payload.email, 'test@example.com');
    });

    it('should reject token with wrong secret', async () => {
      const strategy = new SymmetricVerifierStrategy({ secret });

      const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret', { algorithm: 'HS256' });

      const result = await strategy.verify(token);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('invalid signature'));
    });

    it('should reject expired token', async () => {
      const strategy = new SymmetricVerifierStrategy({ secret });

      const token = jwt.sign({ sub: 'user-123' }, secret, {
        algorithm: 'HS256',
        expiresIn: -10, // Already expired
      });

      const result = await strategy.verify(token);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('expired'));
    });

    it('should reject malformed token', async () => {
      const strategy = new SymmetricVerifierStrategy({ secret });

      const result = await strategy.verify('not-a-valid-jwt');
      assert.strictEqual(result.valid, false);
    });

    it('should verify issuer when specified', async () => {
      const strategy = new SymmetricVerifierStrategy({
        secret,
        issuer: 'expected-issuer',
      });

      const validToken = jwt.sign({ sub: 'user-123', iss: 'expected-issuer' }, secret);
      const invalidToken = jwt.sign({ sub: 'user-123', iss: 'wrong-issuer' }, secret);

      const validResult = await strategy.verify(validToken);
      assert.strictEqual(validResult.valid, true);

      const invalidResult = await strategy.verify(invalidToken);
      assert.strictEqual(invalidResult.valid, false);
    });

    it('should reject non-allowed algorithms', async () => {
      const strategy = new SymmetricVerifierStrategy({
        secret,
        allowedAlgorithms: ['HS256'],
      });

      // Create HS384 token (not allowed)
      const token = jwt.sign({ sub: 'user-123' }, secret, { algorithm: 'HS384' });

      const result = await strategy.verify(token);
      assert.strictEqual(result.valid, false);
    });
  });
});

describe('SupabaseSdkVerifierStrategy', () => {
  describe('constructor', () => {
    it('should throw if supabaseClient not provided', () => {
      assert.throws(() => new SupabaseSdkVerifierStrategy({}), /requires a supabaseClient/);
    });

    it('should accept valid supabaseClient', () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: {} }, error: null }),
        },
      };
      const strategy = new SupabaseSdkVerifierStrategy({ supabaseClient: mockClient });
      assert.strictEqual(strategy.name, 'supabase-sdk');
    });
  });

  describe('verify', () => {
    it('should return valid when SDK returns user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: mockUser }, error: null }),
        },
      };
      const strategy = new SupabaseSdkVerifierStrategy({ supabaseClient: mockClient });

      const result = await strategy.verify('test-token');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.payload.id, 'user-123');
    });

    it('should return invalid when SDK returns error', async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: { message: 'Invalid token' },
          }),
        },
      };
      const strategy = new SupabaseSdkVerifierStrategy({ supabaseClient: mockClient });

      const result = await strategy.verify('test-token');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Invalid token'));
    });

    it('should return invalid when SDK returns no user', async () => {
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      };
      const strategy = new SupabaseSdkVerifierStrategy({ supabaseClient: mockClient });

      const result = await strategy.verify('test-token');
      assert.strictEqual(result.valid, false);
    });

    it('should handle SDK throwing error', async () => {
      const mockClient = {
        auth: {
          getUser: async () => {
            throw new Error('Network error');
          },
        },
      };
      const strategy = new SupabaseSdkVerifierStrategy({ supabaseClient: mockClient });

      const result = await strategy.verify('test-token');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Network error'));
    });
  });
});

describe('JwksVerifierStrategy', () => {
  describe('constructor', () => {
    it('should throw if jwksProvider not provided', () => {
      assert.throws(() => new JwksVerifierStrategy({}), /requires a jwksProvider/);
    });

    it('should accept valid jwksProvider', () => {
      const mockProvider = { getKeyById: async () => null, getFirstKey: async () => null };
      const strategy = new JwksVerifierStrategy({ jwksProvider: mockProvider });
      assert.strictEqual(strategy.name, 'jwks');
    });
  });

  describe('isAvailable', () => {
    it('should always return true', () => {
      const mockProvider = { getKeyById: async () => null, getFirstKey: async () => null };
      const strategy = new JwksVerifierStrategy({ jwksProvider: mockProvider });
      assert.strictEqual(strategy.isAvailable(), true);
    });
  });

  describe('verify', () => {
    it('should return invalid for malformed JWT', async () => {
      const mockProvider = { getKeyById: async () => null, getFirstKey: async () => null };
      const strategy = new JwksVerifierStrategy({ jwksProvider: mockProvider });

      const result = await strategy.verify('not-a-jwt');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Invalid JWT format'));
    });

    it('should reject unsupported algorithm', async () => {
      const mockProvider = { getKeyById: async () => null, getFirstKey: async () => null };
      const strategy = new JwksVerifierStrategy({
        jwksProvider: mockProvider,
        allowedAlgorithms: ['ES256'],
      });

      // Create an HS256 token (symmetric, but we're testing algorithm check)
      const token = jwt.sign({ sub: 'user-123' }, 'secret', { algorithm: 'HS256' });

      const result = await strategy.verify(token);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Unsupported algorithm'));
    });

    it('should return invalid when no matching key found', async () => {
      const mockProvider = {
        getKeyById: async () => null,
        getFirstKey: async () => null,
      };
      const strategy = new JwksVerifierStrategy({
        jwksProvider: mockProvider,
        allowedAlgorithms: ['ES256', 'HS256'], // Allow HS256 to pass algorithm check
      });

      // Create a token that will pass algorithm check
      const token = jwt.sign({ sub: 'user-123' }, 'secret', {
        algorithm: 'HS256',
        keyid: 'test-kid',
      });

      const result = await strategy.verify(token);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('No matching key found'));
    });
  });
});
