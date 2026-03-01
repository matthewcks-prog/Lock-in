/**
 * Health Check & Monitoring Routes
 *
 * Provides endpoints for monitoring service health, including:
 * - Azure embeddings connection status
 * - Circuit breaker status and management
 * - Usage statistics
 * - Diagnostics
 *
 * @module routes/healthRoutes
 */

const express = require('express');
const {
  getEmbeddingsDiagnostics,
  getEmbeddingsHealth,
} = require('../controllers/health/embeddings');
const {
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} = require('../controllers/health/circuitBreaker');
const { requireSupabaseUser } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/health/circuit-breaker
 * Check circuit breaker status for all services
 * Public endpoint for monitoring (no sensitive data exposed)
 */
router.get('/circuit-breaker', getCircuitBreakerStatus);

/**
 * POST /api/health/circuit-breaker/reset
 * Reset circuit breaker for a specific service or all services
 * Requires authentication - admin operation
 */
router.post('/circuit-breaker/reset', requireSupabaseUser, resetCircuitBreaker);

/**
 * GET /api/health/embeddings/diagnostics
 * Run comprehensive diagnostics on embeddings service
 * Requires authentication - admin only
 */
router.get('/diagnostics', requireSupabaseUser, getEmbeddingsDiagnostics);

/**
 * GET /api/health/embeddings
 * Check embeddings service health and get usage stats
 * Requires authentication
 */
router.get('/', requireSupabaseUser, getEmbeddingsHealth);

module.exports = router;
