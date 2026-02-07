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
const { TWO, TEN } = require('../constants/numbers');

const KIBIBYTE = Math.pow(TWO, TEN);
const DEFAULT_BATCH_SIZE = KIBIBYTE * TWO;
const FALLBACK_REASONS = [
  'quota exceeded',
  'rate limited',
  'authentication failed',
  'service error',
  'timeout',
];

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
function createOpenAIEmbeddingsClient(apiKey) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  return new OpenAI({ apiKey });
}

function createProviderConfig({ client, provider, model }) {
  return { client, provider, model };
}

function createAzureProvider(config) {
  const { azureApiKey, azureEndpoint, azureApiVersion, azureDeployment } = config;

  if (!azureApiKey || !azureEndpoint || !azureDeployment) {
    return null;
  }

  try {
    return createProviderConfig({
      client: createAzureEmbeddingsClient(
        azureApiKey,
        azureEndpoint,
        azureApiVersion,
        azureDeployment,
      ),
      provider: EmbeddingsProvider.AZURE_OPENAI,
      model: azureDeployment,
    });
  } catch (error) {
    console.warn('Failed to create Azure embeddings client:', error.message);
    return null;
  }
}

function createOpenAIProvider(config) {
  const { openaiApiKey, openaiModel } = config;

  if (!openaiApiKey || !openaiModel) {
    return null;
  }

  try {
    return createProviderConfig({
      client: createOpenAIEmbeddingsClient(openaiApiKey),
      provider: EmbeddingsProvider.OPENAI,
      model: openaiModel,
    });
  } catch (error) {
    console.warn('Failed to create OpenAI embeddings client:', error.message);
    return null;
  }
}

function resolveProviders(config) {
  const azureProvider = createAzureProvider(config);
  const openaiProvider = createOpenAIProvider(config);

  if (azureProvider) {
    return { primary: azureProvider, fallback: openaiProvider };
  }

  return { primary: openaiProvider, fallback: null };
}

/**
 * Unified embeddings interface
 */
class EmbeddingsClient {
  constructor({ primary, fallback }) {
    this.primary = primary;
    this.fallback = fallback;
    this.primaryClient = primary?.client ?? null;
    this.primaryProvider = primary?.provider ?? null;
    this.primaryModel = primary?.model ?? null;
    this.fallbackClient = fallback?.client ?? null;
    this.fallbackProvider = fallback?.provider ?? null;
    this.fallbackModel = fallback?.model ?? null;
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
      const result = await this.generateEmbeddings(this.primary, input, options);
      return {
        ...result,
        provider: this.primaryProvider,
      };
    } catch (primaryError) {
      // Try fallback if available
      if (this.fallbackClient && this.shouldFallback(primaryError)) {
        try {
          const result = await this.generateEmbeddings(this.fallback, input, options);
          return {
            ...result,
            provider: this.fallbackProvider,
            fallbackUsed: true,
            primaryError: primaryError.message,
          };
        } catch (fallbackError) {
          throw new Error(
            `Embeddings failed. Primary (${this.primaryProvider}): ${primaryError.message}. ` +
              `Fallback (${this.fallbackProvider}): ${fallbackError.message}`,
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Generate embeddings using specific provider
   */
  async generateEmbeddings(providerConfig, input, options) {
    if (!providerConfig) {
      throw new Error('Embeddings provider is not configured');
    }

    if (providerConfig.provider === EmbeddingsProvider.AZURE_OPENAI) {
      return await providerConfig.client.createEmbeddings(input, options);
    }

    // OpenAI provider
    const response = await providerConfig.client.embeddings.create({
      model: providerConfig.model,
      input: input,
      ...options,
    });

    return {
      embeddings: response.data.map((item) => item.embedding),
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
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
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
    const errorMessage = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    return FALLBACK_REASONS.some((reason) => errorMessage.includes(reason));
  }
}

/**
 * Create embeddings client with configuration
 */
function createEmbeddingsClient(config) {
  const { primary, fallback } = resolveProviders(config);

  if (!primary) {
    throw new Error(
      'No embeddings provider available. Configure either Azure OpenAI or OpenAI embeddings.',
    );
  }

  return new EmbeddingsClient({ primary, fallback });
}

module.exports = {
  EmbeddingsClient,
  EmbeddingsProvider,
  createEmbeddingsClient,
};
