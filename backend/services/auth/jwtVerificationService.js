/**
 * JWT Verification Service
 *
 * Orchestrates JWT verification using the Strategy Pattern.
 * This service is the main entry point for token validation in the application.
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for orchestrating verification
 * - Open/Closed: New verification strategies can be added without modifying this class
 * - Liskov Substitution: All strategies implement the same interface
 * - Interface Segregation: Minimal interface for verifiers
 * - Dependency Inversion: Depends on abstractions (strategy interface), not concretions
 *
 * Design Patterns:
 * - Strategy Pattern: Pluggable verification algorithms
 * - Chain of Responsibility: Falls back through multiple strategies
 *
 * @module services/auth/jwtVerificationService
 */

const { logger } = require('../../observability');

/**
 * @typedef {Object} VerificationResult
 * @property {boolean} valid - Whether the token is valid
 * @property {Object} [payload] - The decoded JWT payload if valid
 * @property {string} [error] - Error message if invalid
 * @property {string} [strategy] - Which strategy successfully verified the token
 */

/**
 * @typedef {Object} JwtVerifierStrategy
 * @property {string} name - Strategy name for logging/debugging
 * @property {function(string): Promise<VerificationResult>} verify - Verify a JWT token
 * @property {function(): boolean} [isAvailable] - Check if strategy can be used
 */

/**
 * JWT Verification Service
 *
 * Manages multiple verification strategies and provides a unified interface
 * for token validation with automatic fallback support.
 */
class JwtVerificationService {
  /**
   * Create a new JwtVerificationService
   *
   * @param {Object} options - Configuration options
   * @param {JwtVerifierStrategy[]} options.strategies - Ordered list of verification strategies
   * @param {boolean} [options.failFast=false] - If true, don't try fallback strategies
   */
  constructor({ strategies = [], failFast = false } = {}) {
    if (!Array.isArray(strategies) || strategies.length === 0) {
      throw new Error('JwtVerificationService requires at least one strategy');
    }

    this._strategies = strategies;
    this._failFast = failFast;

    // Validate all strategies implement required interface
    for (const strategy of strategies) {
      this._validateStrategy(strategy);
    }

    logger.debug('[JwtVerificationService] Initialized with strategies:', {
      strategies: strategies.map((s) => s.name),
      failFast,
    });
  }

  /**
   * Validate that a strategy implements the required interface
   *
   * @param {JwtVerifierStrategy} strategy
   * @throws {Error} If strategy is invalid
   */
  _validateStrategy(strategy) {
    if (!strategy.name || typeof strategy.name !== 'string') {
      throw new Error('Strategy must have a "name" property');
    }
    if (typeof strategy.verify !== 'function') {
      throw new Error(`Strategy "${strategy.name}" must have a "verify" method`);
    }
  }

  /**
   * Verify a JWT token using available strategies
   *
   * Tries each strategy in order until one succeeds.
   * This provides resilience and supports migration between auth methods.
   *
   * @param {string} token - The JWT token to verify
   * @returns {Promise<VerificationResult>} Verification result
   */
  async verify(token) {
    if (!token || typeof token !== 'string') {
      return {
        valid: false,
        error: 'Token must be a non-empty string',
      };
    }

    const errors = [];

    for (const strategy of this._strategies) {
      // Check if strategy is available (e.g., has required config)
      if (strategy.isAvailable && !strategy.isAvailable()) {
        logger.debug(
          `[JwtVerificationService] Strategy "${strategy.name}" not available, skipping`,
        );
        continue;
      }

      try {
        const result = await strategy.verify(token);

        if (result.valid) {
          logger.debug(`[JwtVerificationService] Token verified by "${strategy.name}"`);
          return {
            ...result,
            strategy: strategy.name,
          };
        }

        // Strategy returned invalid but no error
        errors.push({
          strategy: strategy.name,
          error: result.error || 'Verification failed',
        });

        // If failFast is enabled, don't try other strategies
        if (this._failFast) {
          break;
        }
      } catch (err) {
        errors.push({
          strategy: strategy.name,
          error: err.message,
        });

        logger.debug(`[JwtVerificationService] Strategy "${strategy.name}" threw error:`, {
          error: err.message,
        });

        // If failFast is enabled, propagate the error
        if (this._failFast) {
          break;
        }
      }
    }

    // All strategies failed
    const errorSummary = errors.map((e) => `${e.strategy}: ${e.error}`).join('; ');
    logger.warn('[JwtVerificationService] All strategies failed:', { errors });

    return {
      valid: false,
      error: `Token verification failed: ${errorSummary}`,
    };
  }

  /**
   * Get list of available strategy names
   *
   * @returns {string[]} Array of available strategy names
   */
  getAvailableStrategies() {
    return this._strategies.filter((s) => !s.isAvailable || s.isAvailable()).map((s) => s.name);
  }

  /**
   * Check if the service has any available strategies
   *
   * @returns {boolean} True if at least one strategy is available
   */
  hasAvailableStrategy() {
    return this.getAvailableStrategies().length > 0;
  }
}

module.exports = { JwtVerificationService };
