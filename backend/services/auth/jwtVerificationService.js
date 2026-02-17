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
const CIRCUIT_OPEN_ERROR_NAME = 'CircuitOpenError';
const SERVICE_UNAVAILABLE_CODE = 'SERVICE_UNAVAILABLE';
const CIRCUIT_OPEN_MESSAGE_SNIPPET = 'circuit open';

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

  _isStrategyAvailable(strategy) {
    if (!strategy.isAvailable) {
      return true;
    }
    return strategy.isAvailable();
  }

  _isCircuitBreakerError(errorLike) {
    return (
      errorLike?.name === CIRCUIT_OPEN_ERROR_NAME ||
      errorLike?.code === SERVICE_UNAVAILABLE_CODE ||
      (typeof errorLike?.message === 'string' &&
        errorLike.message.includes(CIRCUIT_OPEN_MESSAGE_SNIPPET))
    );
  }

  _pushError(errors, { strategy, error, isTransient }) {
    errors.push({ strategy, error, isTransient });
  }

  _logUnavailableStrategy(strategy) {
    logger.debug(`[JwtVerificationService] Strategy "${strategy.name}" not available, skipping`);
  }

  _logCircuitBreakerFallback(strategyName) {
    logger.debug(
      `[JwtVerificationService] Strategy "${strategyName}" circuit breaker open, trying fallback`,
    );
  }

  _logStrategyThrow(strategyName, errorMessage, isCircuitError) {
    logger.debug(`[JwtVerificationService] Strategy "${strategyName}" threw error:`, {
      error: errorMessage,
      isCircuitError,
    });
  }

  _buildFailureResult(errors, hasCircuitBreakerError) {
    const errorSummary = errors.map((entry) => `${entry.strategy}: ${entry.error}`).join('; ');
    logger.warn('[JwtVerificationService] All strategies failed:', { errors });

    return {
      valid: false,
      error: `Token verification failed: ${errorSummary}`,
      isServiceUnavailable: hasCircuitBreakerError && errors.every((entry) => entry.isTransient),
    };
  }

  _shouldStopAfterFailure(isCircuitBreakerError) {
    return this._failFast && !isCircuitBreakerError;
  }

  _handleInvalidStrategyResult(strategy, result, state) {
    const isCircuitError = Boolean(result.isCircuitBreakerError);
    if (isCircuitError) {
      state.hasCircuitBreakerError = true;
      this._logCircuitBreakerFallback(strategy.name);
    }

    this._pushError(state.errors, {
      strategy: strategy.name,
      error: result.error || 'Verification failed',
      isTransient: result.isTransient || false,
    });

    return this._shouldStopAfterFailure(isCircuitError);
  }

  _handleStrategyException(strategy, error, state) {
    const isCircuitError = this._isCircuitBreakerError(error);
    if (isCircuitError) {
      state.hasCircuitBreakerError = true;
      this._logCircuitBreakerFallback(strategy.name);
    }

    this._pushError(state.errors, {
      strategy: strategy.name,
      error: error.message,
      isTransient: isCircuitError,
    });

    this._logStrategyThrow(strategy.name, error.message, isCircuitError);
    return this._shouldStopAfterFailure(isCircuitError);
  }

  async _verifyWithStrategy(strategy, token, state) {
    try {
      const result = await strategy.verify(token);
      if (result.valid) {
        logger.debug(`[JwtVerificationService] Token verified by "${strategy.name}"`);
        return {
          stop: true,
          success: {
            ...result,
            strategy: strategy.name,
          },
        };
      }

      return { stop: this._handleInvalidStrategyResult(strategy, result, state), success: null };
    } catch (error) {
      return { stop: this._handleStrategyException(strategy, error, state), success: null };
    }
  }

  /**
   * Verify a JWT token using available strategies
   *
   * Tries each strategy in order until one succeeds.
   * This provides resilience and supports migration between auth methods.
   *
   * Circuit Breaker Handling:
   * - When a strategy fails due to circuit breaker, we always try fallback strategies
   * - This ensures authentication continues working even during Supabase outages
   * - Local JWKS or symmetric verification can serve as fallback
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

    const state = {
      errors: [],
      hasCircuitBreakerError: false,
    };

    for (const strategy of this._strategies) {
      if (!this._isStrategyAvailable(strategy)) {
        this._logUnavailableStrategy(strategy);
        continue;
      }

      const strategyOutcome = await this._verifyWithStrategy(strategy, token, state);
      if (strategyOutcome.success) {
        return strategyOutcome.success;
      }
      if (strategyOutcome.stop) {
        break;
      }
    }

    return this._buildFailureResult(state.errors, state.hasCircuitBreakerError);
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
