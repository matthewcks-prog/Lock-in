/**
 * Unit Tests for JWT Verification Service
 *
 * Tests the Strategy Pattern implementation for JWT verification.
 * Uses mock strategies to test orchestration logic in isolation.
 *
 * @module services/auth/__tests__/jwtVerificationService.test
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JwtVerificationService } = require('../jwtVerificationService');

describe('JwtVerificationService', () => {
  describe('constructor', () => {
    it('should throw if no strategies provided', () => {
      assert.throws(
        () => new JwtVerificationService({ strategies: [] }),
        /requires at least one strategy/,
      );
    });

    it('should throw if strategies is not an array', () => {
      assert.throws(
        () => new JwtVerificationService({ strategies: 'invalid' }),
        /requires at least one strategy/,
      );
    });

    it('should throw if strategy lacks name', () => {
      const invalidStrategy = { verify: async () => ({ valid: true }) };
      assert.throws(
        () => new JwtVerificationService({ strategies: [invalidStrategy] }),
        /must have a "name" property/,
      );
    });

    it('should throw if strategy lacks verify method', () => {
      const invalidStrategy = { name: 'test' };
      assert.throws(
        () => new JwtVerificationService({ strategies: [invalidStrategy] }),
        /must have a "verify" method/,
      );
    });

    it('should accept valid strategies', () => {
      const validStrategy = {
        name: 'test',
        verify: async () => ({ valid: true }),
      };
      const service = new JwtVerificationService({ strategies: [validStrategy] });
      assert.ok(service);
    });
  });

  describe('verify', () => {
    it('should return invalid for empty token', async () => {
      const strategy = {
        name: 'test',
        verify: async () => ({ valid: true }),
      };
      const service = new JwtVerificationService({ strategies: [strategy] });

      const result = await service.verify('');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('non-empty string'));
    });

    it('should return invalid for null token', async () => {
      const strategy = {
        name: 'test',
        verify: async () => ({ valid: true }),
      };
      const service = new JwtVerificationService({ strategies: [strategy] });

      const result = await service.verify(null);
      assert.strictEqual(result.valid, false);
    });

    it('should use first successful strategy', async () => {
      const strategy1 = {
        name: 'strategy1',
        verify: async () => ({ valid: true, payload: { sub: 'user1' } }),
      };
      const strategy2 = {
        name: 'strategy2',
        verify: async () => ({ valid: true, payload: { sub: 'user2' } }),
      };
      const service = new JwtVerificationService({ strategies: [strategy1, strategy2] });

      const result = await service.verify('test-token');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.strategy, 'strategy1');
      assert.strictEqual(result.payload.sub, 'user1');
    });

    it('should fallback to second strategy if first fails', async () => {
      const strategy1 = {
        name: 'strategy1',
        verify: async () => ({ valid: false, error: 'First failed' }),
      };
      const strategy2 = {
        name: 'strategy2',
        verify: async () => ({ valid: true, payload: { sub: 'user2' } }),
      };
      const service = new JwtVerificationService({ strategies: [strategy1, strategy2] });

      const result = await service.verify('test-token');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.strategy, 'strategy2');
    });

    it('should skip unavailable strategies', async () => {
      const strategy1 = {
        name: 'unavailable',
        isAvailable: () => false,
        verify: async () => ({ valid: true, payload: { sub: 'user1' } }),
      };
      const strategy2 = {
        name: 'available',
        isAvailable: () => true,
        verify: async () => ({ valid: true, payload: { sub: 'user2' } }),
      };
      const service = new JwtVerificationService({ strategies: [strategy1, strategy2] });

      const result = await service.verify('test-token');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.strategy, 'available');
    });

    it('should handle strategy that throws error', async () => {
      const strategy1 = {
        name: 'throwing',
        verify: async () => {
          throw new Error('Network error');
        },
      };
      const strategy2 = {
        name: 'working',
        verify: async () => ({ valid: true, payload: { sub: 'user2' } }),
      };
      const service = new JwtVerificationService({ strategies: [strategy1, strategy2] });

      const result = await service.verify('test-token');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.strategy, 'working');
    });

    it('should return combined error when all strategies fail', async () => {
      const strategy1 = {
        name: 'first',
        verify: async () => ({ valid: false, error: 'Error 1' }),
      };
      const strategy2 = {
        name: 'second',
        verify: async () => ({ valid: false, error: 'Error 2' }),
      };
      const service = new JwtVerificationService({ strategies: [strategy1, strategy2] });

      const result = await service.verify('test-token');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('first: Error 1'));
      assert.ok(result.error.includes('second: Error 2'));
    });

    it('should fail fast when failFast is true', async () => {
      let strategy2Called = false;
      const strategy1 = {
        name: 'first',
        verify: async () => ({ valid: false, error: 'First error' }),
      };
      const strategy2 = {
        name: 'second',
        verify: async () => {
          strategy2Called = true;
          return { valid: true, payload: {} };
        },
      };
      const service = new JwtVerificationService({
        strategies: [strategy1, strategy2],
        failFast: true,
      });

      const result = await service.verify('test-token');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(strategy2Called, false);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return all strategies when none have isAvailable', () => {
      const strategies = [
        { name: 'a', verify: async () => ({ valid: true }) },
        { name: 'b', verify: async () => ({ valid: true }) },
      ];
      const service = new JwtVerificationService({ strategies });

      assert.deepStrictEqual(service.getAvailableStrategies(), ['a', 'b']);
    });

    it('should filter out unavailable strategies', () => {
      const strategies = [
        { name: 'a', isAvailable: () => true, verify: async () => ({ valid: true }) },
        { name: 'b', isAvailable: () => false, verify: async () => ({ valid: true }) },
        { name: 'c', isAvailable: () => true, verify: async () => ({ valid: true }) },
      ];
      const service = new JwtVerificationService({ strategies });

      assert.deepStrictEqual(service.getAvailableStrategies(), ['a', 'c']);
    });
  });

  describe('hasAvailableStrategy', () => {
    it('should return true when strategies are available', () => {
      const strategies = [{ name: 'a', verify: async () => ({ valid: true }) }];
      const service = new JwtVerificationService({ strategies });

      assert.strictEqual(service.hasAvailableStrategy(), true);
    });

    it('should return false when no strategies are available', () => {
      const strategies = [
        { name: 'a', isAvailable: () => false, verify: async () => ({ valid: true }) },
      ];
      const service = new JwtVerificationService({ strategies });

      assert.strictEqual(service.hasAvailableStrategy(), false);
    });
  });
});
