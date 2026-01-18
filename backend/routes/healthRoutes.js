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
const { getEmbeddingsStats, runEmbeddingsDiagnostics } = require('../services/embeddings');
const { requireSupabaseUser } = require('../authMiddleware');

const router = express.Router();

/**
 * GET /api/health/embeddings/diagnostics
 * Run comprehensive diagnostics on embeddings service
 * Requires authentication - admin only
 */
router.get('/diagnostics', requireSupabaseUser, async (req, res) => {
  try {
    const diagnostics = await runEmbeddingsDiagnostics();
    res.json({
      status: 'ok',
      diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/embeddings
 * Check embeddings service health and get usage stats
 * Requires authentication
 */
router.get('/', requireSupabaseUser, (req, res) => {
  try {
    const stats = getEmbeddingsStats();
    res.json({
      status: 'ok',
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
