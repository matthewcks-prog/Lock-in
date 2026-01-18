/**
 * Embeddings Service Wrapper
 *
 * Provides unified interface for text embeddings with Azure OpenAI (primary)
 * and OpenAI (fallback). Uses embeddingsFactory for proper provider routing.
 *
 * Strategy:
 * - Primary: Azure OpenAI Embeddings (uses $100 Azure credits, 1000 TPM quota)
 * - Fallback: OpenAI Embeddings (when Azure unavailable or quota exceeded)
 *
 * @module services/embeddings
 */

const { createEmbeddingsClient } = require('../providers/embeddingsFactory');
const {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
  OPENAI_API_KEY,
  OPENAI_EMBEDDINGS_MODEL,
} = require('../config');

let embeddingsClientInstance = null;

/**
 * Get or create embeddings client singleton
 */
function getEmbeddingsClient() {
  if (!embeddingsClientInstance) {
    embeddingsClientInstance = createEmbeddingsClient({
      azureApiKey: AZURE_OPENAI_API_KEY,
      azureEndpoint: AZURE_OPENAI_ENDPOINT,
      azureApiVersion: AZURE_OPENAI_API_VERSION,
      azureDeployment: AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
      openaiApiKey: OPENAI_API_KEY,
      openaiModel: OPENAI_EMBEDDINGS_MODEL,
    });
  }
  return embeddingsClientInstance;
}

/**
 * Generate embedding for text
 *
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Array of embedding floats
 */
async function embedText(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text is required and must be a non-empty string');
  }

  const client = getEmbeddingsClient();
  const embedding = await client.embed(text.trim());

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 *
 * @param {string[]} texts - Array of texts to embed
 * @param {Object} options - Batch options
 * @returns {Promise<number[][]>} Array of embedding arrays
 */
async function embedTexts(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }

  const client = getEmbeddingsClient();
  const embeddings = await client.batchEmbed(texts, options);

  return embeddings;
}

/**
 * Get embeddings usage statistics
 * Useful for monitoring API usage and costs
 */
function getEmbeddingsStats() {
  const client = getEmbeddingsClient();

  // Try to get stats from primary Azure client
  if (client.primaryClient && typeof client.primaryClient.getStats === 'function') {
    return {
      provider: client.primaryProvider,
      stats: client.primaryClient.getStats(),
    };
  }

  return {
    provider: 'unknown',
    stats: null,
  };
}

/**
 * Run diagnostics on embeddings connection
 */
async function runEmbeddingsDiagnostics() {
  const client = getEmbeddingsClient();

  if (client.primaryClient && typeof client.primaryClient.runDiagnostics === 'function') {
    return await client.primaryClient.runDiagnostics();
  }

  throw new Error('Diagnostics not supported by current embeddings provider');
}

module.exports = {
  embedText,
  embedTexts,
  getEmbeddingsClient,
  getEmbeddingsStats,
  runEmbeddingsDiagnostics,
};
