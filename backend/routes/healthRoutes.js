/**
 * Health Check & Monitoring Routes
 *
 * Provides endpoints for monitoring service health, including:
 * - Azure embeddings connection status
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
const { requireSupabaseUser } = require('../middleware/authMiddleware');

const router = express.Router();

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
