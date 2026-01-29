const { getEmbeddingsStats, runEmbeddingsDiagnostics } = require('../../services/embeddings');

async function getEmbeddingsDiagnostics(req, res) {
  try {
    const diagnostics = await runEmbeddingsDiagnostics();
    return res.json({
      status: 'ok',
      diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

function getEmbeddingsHealth(req, res) {
  try {
    const stats = getEmbeddingsStats();
    return res.json({
      status: 'ok',
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  getEmbeddingsDiagnostics,
  getEmbeddingsHealth,
};
