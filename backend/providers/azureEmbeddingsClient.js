/**
 * Azure OpenAI Embeddings Client
 * 
 * Provides text embeddings using Azure OpenAI Service.
 * This is the primary embeddings service, leveraging Azure credits.
 * 
 * Features:
 * - text-embedding-3-small model
 * - Batch processing support
 * - Automatic retry with exponential backoff
 * 
 * @module providers/azureEmbeddingsClient
 */

const { AzureOpenAI } = require('openai');

/**
 * Azure Embeddings client configuration
 */
class AzureEmbeddingsConfig {
  constructor({ apiKey, endpoint, apiVersion, deployment }) {
    if (!apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY is required for embeddings');
    }
    if (!endpoint) {
      throw new Error('AZURE_OPENAI_ENDPOINT is required for embeddings');
    }
    if (!deployment) {
      throw new Error('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT is required');
    }

    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.apiVersion = apiVersion || '2024-02-01';
    this.deployment = deployment;
  }
}

/**
 * Azure OpenAI Embeddings client
 */
class AzureEmbeddingsClient {
  constructor(config) {
    this.config = config;
    this.client = new AzureOpenAI({
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
      endpoint: config.endpoint,
      timeout: 60000, // 60 second timeout for embeddings
      maxRetries: 3, // Retry failed requests up to 3 times
    });
    
    // Usage tracking for monitoring and cost estimation
    this.stats = {
      totalRequests: 0,
      totalTokens: 0,
      totalEmbeddings: 0,
      errors: 0,
      lastRequestTime: null,
    };
  }

  /**
   * Get usage statistics
   * Useful for monitoring API usage and estimating costs
   */
  getStats() {
    return {
      ...this.stats,
      estimatedCost: (this.stats.totalTokens / 1000000) * 0.02, // $0.02 per 1M tokens for text-embedding-3-small
    };
  }

  /**
   * Reset usage statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      totalTokens: 0,
      totalEmbeddings: 0,
      errors: 0,
      lastRequestTime: null,
    };
  }

  /**
   * Generate embeddings for text input
   * 
   * @param {string|string[]} input - Text or array of texts to embed
   * @param {Object} options - Embedding options
   * @param {number} options.dimensions - Optional dimensions (for 3-small: 512 or 1536)
   * @returns {Promise<Object>} Embeddings result
   */
  async createEmbeddings(input, options = {}) {
    try {
      const params = {
        model: this.config.deployment,
        input: input,
      };

      // text-embedding-3-small supports dimensions parameter
      if (options.dimensions) {
        params.dimensions = options.dimensions;
      }

      const response = await this.client.embeddings.create(params);

      // Track usage
      this.stats.totalRequests++;
      this.stats.totalTokens += response.usage.total_tokens;
      this.stats.totalEmbeddings += response.data.length;
      this.stats.lastRequestTime = new Date();

      return {
        embeddings: response.data.map(item => item.embedding),
        model: response.model,
        usage: response.usage,
      };
    } catch (error) {
      this.stats.errors++;
      throw this.handleError(error);
    }
  }

  /**
   * Generate single embedding
   * 
   * @param {string} text - Text to embed
   * @param {Object} options - Embedding options
   * @returns {Promise<number[]>} Embedding vector
   */
  async embed(text, options = {}) {
    const result = await this.createEmbeddings(text, options);
    return result.embeddings[0];
  }

  /**
   * Generate embeddings in batches
   * 
   * @param {string[]} texts - Array of texts to embed
   * @param {Object} options - Embedding options
   * @param {number} options.batchSize - Batch size (default: 2048, max for Azure)
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async batchEmbed(texts, options = {}) {
    const batchSize = options.batchSize || 2048;
    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const result = await this.createEmbeddings(batch, options);
      embeddings.push(...result.embeddings);
    }

    return embeddings;
  }

  /**
   * Handle API errors with detailed diagnostics
   */
  handleError(error) {
    const errorContext = {
      endpoint: this.config.endpoint,
      deployment: this.config.deployment,
      apiVersion: this.config.apiVersion,
    };

    // Network/Connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return new Error(
        `Azure embeddings connection error: Cannot reach ${errorContext.endpoint}. ` +
        `Please verify: 1) Endpoint URL is correct, 2) Network connection is active, ` +
        `3) Firewall allows outbound HTTPS. Error: ${error.message}`
      );
    }

    // Rate limiting
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'] || 'unknown';
      return new Error(
        `Azure embeddings quota exceeded or rate limited. ` +
        `Retry after: ${retryAfter} seconds. ` +
        `Deployment: ${errorContext.deployment}, TPM Limit: 120K`
      );
    }

    // Authentication errors
    if (error.status === 401 || error.status === 403) {
      return new Error(
        `Azure embeddings authentication failed. ` +
        `Please verify: 1) AZURE_OPENAI_API_KEY is correct, ` +
        `2) API key has not expired, 3) Resource '${errorContext.deployment}' exists. ` +
        `Status: ${error.status}`
      );
    }

    // Resource not found
    if (error.status === 404) {
      return new Error(
        `Azure embeddings deployment not found. ` +
        `Please verify deployment '${errorContext.deployment}' exists at ${errorContext.endpoint}. ` +
        `Run: az cognitiveservices account deployment list`
      );
    }

    // Service errors
    if (error.status >= 500) {
      return new Error(
        `Azure embeddings service error (${error.status}): ${error.message}. ` +
        `The Azure OpenAI service may be experiencing issues. ` +
        `Endpoint: ${errorContext.endpoint}`
      );
    }

    // Generic error with context
    return new Error(
      `Azure embeddings error: ${error.message}. ` +
      `Status: ${error.status || 'unknown'}, ` +
      `Code: ${error.code || 'none'}, ` +
      `Deployment: ${errorContext.deployment}`
    );
  }

  /**
   * Check if Azure embeddings service is available
   */
  async healthCheck() {
    try {
      await this.embed('test');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run diagnostics on Azure embeddings connection
   * Useful for troubleshooting connection issues
   */
  async runDiagnostics() {
    const diagnostics = {
      endpoint: this.config.endpoint,
      deployment: this.config.deployment,
      apiVersion: this.config.apiVersion,
      tests: {},
    };

    // Test 1: Basic connectivity
    try {
      const testEmbedding = await this.embed('diagnostic test', { dimensions: 512 });
      diagnostics.tests.connectivity = {
        status: 'passed',
        embeddingLength: testEmbedding.length,
      };
    } catch (error) {
      diagnostics.tests.connectivity = {
        status: 'failed',
        error: error.message,
        code: error.code,
      };
    }

    // Test 2: Batch processing
    try {
      const batchEmbeddings = await this.batchEmbed(['test 1', 'test 2', 'test 3']);
      diagnostics.tests.batchProcessing = {
        status: 'passed',
        itemsProcessed: batchEmbeddings.length,
      };
    } catch (error) {
      diagnostics.tests.batchProcessing = {
        status: 'failed',
        error: error.message,
      };
    }

    return diagnostics;
  }
}

/**
 * Create Azure embeddings client from config
 */
function createAzureEmbeddingsClient(apiKey, endpoint, apiVersion, deployment) {
  const config = new AzureEmbeddingsConfig({ apiKey, endpoint, apiVersion, deployment });
  const client = new AzureEmbeddingsClient(config);
  
  // Log configuration (without exposing sensitive data)
  console.log('[Azure Embeddings] Initialized:', {
    endpoint: config.endpoint,
    deployment: config.deployment,
    apiVersion: config.apiVersion,
    hasApiKey: Boolean(config.apiKey),
  });
  
  return client;
}

module.exports = {
  AzureEmbeddingsClient,
  AzureEmbeddingsConfig,
  createAzureEmbeddingsClient,
};
