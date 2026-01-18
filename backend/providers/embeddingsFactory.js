/**
 * Embeddings Provider Factory
 * 
 * Creates embeddings clients with automatic fallback:
 * - Primary: Azure OpenAI Embeddings (uses Azure credits)
 * - Fallback: OpenAI Embeddings (when Azure unavailable)
 * 
 * @module providers/embeddingsFactory
 */

const { createAzureEmbeddingsClient } = require('./azureEmbeddingsClient');
const OpenAI = require('openai');

/**
 * Embeddings provider types
 */
const EmbeddingsProvider = {
  AZURE_OPENAI: 'azure-openai',
  OPENAI: 'openai',
};

/**
 * Create OpenAI embeddings client
 */
function createOpenAIEmbeddingsClient(apiKey, model) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  return { client: new OpenAI({ apiKey }), model };
}

/**
 * Unified embeddings interface
 */
class EmbeddingsClient {
  constructor(primaryClient, primaryProvider, primaryModel, fallbackClient, fallbackProvider, fallbackModel) {
    this.primaryClient = primaryClient;
    this.primaryProvider = primaryProvider;
    this.primaryModel = primaryModel;
    this.fallbackClient = fallbackClient;
    this.fallbackProvider = fallbackProvider;
    this.fallbackModel = fallbackModel;
  }

  /**
   * Generate embeddings with automatic fallback
   * 
   * @param {string|string[]} input - Text or array of texts
   * @param {Object} options - Embedding options
   * @returns {Promise<Object>} Embeddings result
   */
  async createEmbeddings(input, options = {}) {
    try {
      // Try primary provider
      const result = await this.generateEmbeddings(
        this.primaryClient,
        this.primaryProvider,
        this.primaryModel,
        input,
        options
      );
      return {
        ...result,
        provider: this.primaryProvider,
      };
    } catch (primaryError) {
      // Try fallback if available
      if (this.fallbackClient && this.shouldFallback(primaryError)) {
        try {
          const result = await this.generateEmbeddings(
            this.fallbackClient,
            this.fallbackProvider,
            this.fallbackModel,
            input,
            options
          );
          return {
            ...result,
            provider: this.fallbackProvider,
            fallbackUsed: true,
            primaryError: primaryError.message,
          };
        } catch (fallbackError) {
          throw new Error(
            `Embeddings failed. Primary (${this.primaryProvider}): ${primaryError.message}. ` +
            `Fallback (${this.fallbackProvider}): ${fallbackError.message}`
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Generate embeddings using specific provider
   */
  async generateEmbeddings(client, provider, model, input, options) {
    if (provider === EmbeddingsProvider.AZURE_OPENAI) {
      return await client.createEmbeddings(input, options);
    }

    // OpenAI provider
    const response = await client.client.embeddings.create({
      model: model,
      input: input,
      ...options,
    });

    return {
      embeddings: response.data.map(item => item.embedding),
      model: response.model,
      usage: response.usage,
    };
  }

  /**
   * Generate single embedding
   */
  async embed(text, options = {}) {
    const result = await this.createEmbeddings(text, options);
    return result.embeddings[0];
  }

  /**
   * Generate embeddings in batches
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
   * Determine if fallback should be used
   */
  shouldFallback(error) {
    const fallbackReasons = [
      'quota exceeded',
      'rate limited',
      'authentication failed',
      'service error',
      'timeout',
    ];

    const errorMessage = error.message.toLowerCase();
    return fallbackReasons.some(reason => errorMessage.includes(reason));
  }
}

/**
 * Create embeddings client with configuration
 */
function createEmbeddingsClient(config) {
  const {
    azureApiKey,
    azureEndpoint,
    azureApiVersion,
    azureDeployment,
    openaiApiKey,
    openaiModel,
  } = config;

  let primaryClient = null;
  let primaryProvider = null;
  let primaryModel = null;
  let fallbackClient = null;
  let fallbackProvider = null;
  let fallbackModel = null;

  // Try to create Azure embeddings client (primary)
  if (azureApiKey && azureEndpoint && azureDeployment) {
    try {
      primaryClient = createAzureEmbeddingsClient(
        azureApiKey,
        azureEndpoint,
        azureApiVersion,
        azureDeployment
      );
      primaryProvider = EmbeddingsProvider.AZURE_OPENAI;
      primaryModel = azureDeployment;
    } catch (error) {
      console.warn('Failed to create Azure embeddings client:', error.message);
    }
  }

  // Create OpenAI embeddings client (fallback or primary if Azure unavailable)
  if (openaiApiKey && openaiModel) {
    try {
      const openaiClient = createOpenAIEmbeddingsClient(openaiApiKey, openaiModel);
      
      if (primaryClient) {
        // Use as fallback
        fallbackClient = openaiClient;
        fallbackProvider = EmbeddingsProvider.OPENAI;
        fallbackModel = openaiModel;
      } else {
        // Use as primary
        primaryClient = openaiClient;
        primaryProvider = EmbeddingsProvider.OPENAI;
        primaryModel = openaiModel;
      }
    } catch (error) {
      console.warn('Failed to create OpenAI embeddings client:', error.message);
    }
  }

  if (!primaryClient) {
    throw new Error(
      'No embeddings provider available. Configure either Azure OpenAI or OpenAI embeddings.'
    );
  }

  return new EmbeddingsClient(
    primaryClient,
    primaryProvider,
    primaryModel,
    fallbackClient,
    fallbackProvider,
    fallbackModel
  );
}

module.exports = {
  EmbeddingsClient,
  EmbeddingsProvider,
  createEmbeddingsClient,
};
