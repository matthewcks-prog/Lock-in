/**
 * Circuit Breaker Health Controller
 *
 * Provides endpoints for monitoring and managing circuit breaker states.
 * These are critical for observability and manual recovery during incidents.
 *
 * Endpoints:
 * - GET /status: View current circuit breaker states
 * - POST /reset: Manually reset circuit breakers (admin only)
 *
 * @module controllers/health/circuitBreaker
 */

const {
  SUPPORTED_CIRCUIT_BREAKER_SERVICES,
  getCircuitBreakerStatus: getCircuitBreakerStatusService,
  resetCircuitBreaker: resetCircuitBreakerService,
} = require('../../services/health/circuitBreakerService');
const { logger } = require('../../observability');
const HTTP_STATUS = require('../../constants/httpStatus');

/**
 * Get current circuit breaker status for all services
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function getCircuitBreakerStatus(req, res) {
  try {
    const status = await getCircuitBreakerStatusService();

    logger.debug('[CircuitBreaker] Status requested', { status });

    res.status(HTTP_STATUS.OK).json(status);
  } catch (error) {
    logger.error('[CircuitBreaker] Failed to get status', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get circuit breaker status',
      code: 'health/circuit-breaker-error',
    });
  }
}

/**
 * Reset circuit breaker for a specific service or all services
 *
 * This is a manual recovery operation for use during incidents.
 * Should be admin-only in production.
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function resetCircuitBreaker(req, res) {
  try {
    const { service } = req.body;

    if (service && !SUPPORTED_CIRCUIT_BREAKER_SERVICES.includes(service) && service !== 'all') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `Unknown service: ${service}`,
        code: 'health/unknown-service',
        validServices: [...SUPPORTED_CIRCUIT_BREAKER_SERVICES, 'all'],
      });
    }

    const reset = await resetCircuitBreakerService({ service });

    if (reset.results?.supabase?.success) {
      logger.info('[CircuitBreaker] Reset performed', {
        service: 'supabase',
        beforeState: reset.results.supabase.beforeState,
        afterState: reset.results.supabase.afterState,
        userId: req.user?.id,
      });
    }

    res.status(HTTP_STATUS.OK).json(reset);
  } catch (error) {
    logger.error('[CircuitBreaker] Failed to reset', { error: error.message });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to reset circuit breaker',
      code: 'health/circuit-breaker-reset-error',
    });
  }
}

module.exports = {
  getCircuitBreakerStatus,
  resetCircuitBreaker,
};
