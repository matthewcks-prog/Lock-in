/**
 * Transcription Provider Factory
 *
 * Creates transcription clients with automatic fallback:
 * - Primary: Azure Speech-to-Text (uses Azure credits, 5hrs/month free)
 * - Fallback: OpenAI Whisper (when Azure quota exceeded or unavailable)
 *
 * @module providers/transcriptionFactory
 */

const { createAzureSpeechClient } = require('./azureSpeechClient');
const OpenAI = require('openai');
const { AppError } = require('../errors');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const { ONE, THREE, SIXTY, THOUSAND } = require('../constants/numbers');
const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Transcription provider types
 */
const TranscriptionProvider = {
  AZURE_SPEECH: 'azure-speech',
  OPENAI_WHISPER: 'openai-whisper',
};

const DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
  failureThreshold: THREE,
  openDurationMs: SIXTY * THOUSAND,
  halfOpenMaxAttempts: ONE,
};

const FALLBACK_REASONS = [
  'quota exceeded',
  'rate limited',
  'authentication failed',
  'service error',
  'timeout',
];

const CIRCUIT_OPEN_ERROR_NAME = 'CircuitOpenError';

function createCircuitOpenError(provider, decision) {
  const error = new AppError(
    `Transcription provider ${provider} temporarily unavailable (circuit open)`,
    'SERVICE_UNAVAILABLE',
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    { provider, retryAfterMs: decision.retryAfterMs },
  );
  error.name = CIRCUIT_OPEN_ERROR_NAME;
  return error;
}

/**
 * Create OpenAI Whisper client
 */
function createWhisperClient(apiKey) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for Whisper fallback');
  }
  return new OpenAI({ apiKey });
}

function createProviderConfig({ client, provider }) {
  return { client, provider };
}

function createAzureProvider(config) {
  const { azureSpeechApiKey, azureSpeechRegion, preferredLanguage } = config;

  if (!azureSpeechApiKey || !azureSpeechRegion) {
    return null;
  }

  try {
    return createProviderConfig({
      client: createAzureSpeechClient(azureSpeechApiKey, azureSpeechRegion, preferredLanguage),
      provider: TranscriptionProvider.AZURE_SPEECH,
    });
  } catch (error) {
    console.warn('Failed to create Azure Speech client:', error.message);
    return null;
  }
}

function createWhisperProvider(config) {
  const { openaiApiKey } = config;

  if (!openaiApiKey) {
    return null;
  }

  try {
    return createProviderConfig({
      client: createWhisperClient(openaiApiKey),
      provider: TranscriptionProvider.OPENAI_WHISPER,
    });
  } catch (error) {
    console.warn('Failed to create OpenAI Whisper client:', error.message);
    return null;
  }
}

function resolveProviders(config) {
  const azureProvider = createAzureProvider(config);
  const whisperProvider = createWhisperProvider(config);

  if (azureProvider) {
    return { primary: azureProvider, fallback: whisperProvider };
  }

  return { primary: whisperProvider, fallback: null };
}

/**
 * Unified transcription interface
 */
class TranscriptionClient {
  constructor({ primary, fallback, circuitBreaker, circuitBreakerOptions } = {}) {
    this.primary = primary;
    this.fallback = fallback;
    this.primaryClient = primary?.client ?? null;
    this.primaryProvider = primary?.provider ?? null;
    this.fallbackClient = fallback?.client ?? null;
    this.fallbackProvider = fallback?.provider ?? null;
    this._circuitBreaker =
      circuitBreaker ??
      new CircuitBreaker(circuitBreakerOptions ?? DEFAULT_CIRCUIT_BREAKER_OPTIONS);
  }

  /**
   * Transcribe audio with automatic fallback
   *
   * @param {Buffer|Stream} audioData - Audio file data or file path
   * @param {Object} options - Transcription options
   * @param {string} options.language - Language code ('en', 'es', etc.)
   * @param {string} options.format - Audio format
   * @param {string} options.filename - Original filename (for Whisper)
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    const primaryDecision = await this._circuitBreaker.canRequest(this.primaryProvider);
    if (!primaryDecision.allowed) {
      return await this.handleCircuitOpen(audioData, options, primaryDecision);
    }

    try {
      const result = await this.transcribeWithProvider(this.primaryProvider, audioData, options);
      await this.recordSuccess(this.primaryProvider);
      return {
        ...result,
        provider: this.primaryProvider,
      };
    } catch (primaryError) {
      await this.recordFailure(this.primaryProvider, primaryError);
      return await this.handlePrimaryError(primaryError, audioData, options);
    }
  }

  hasFallback() {
    return Boolean(this.fallbackClient && this.fallbackProvider);
  }

  async recordSuccess(provider) {
    await this._circuitBreaker.recordSuccess(provider);
  }

  async recordFailure(provider, error) {
    if (error?.name !== CIRCUIT_OPEN_ERROR_NAME) {
      await this._circuitBreaker.recordFailure(provider);
    }
  }

  async handleCircuitOpen(audioData, options, primaryDecision) {
    if (!this.hasFallback()) {
      throw createCircuitOpenError(this.primaryProvider, primaryDecision);
    }

    return await this.transcribeWithFallback(audioData, options, {
      primaryError: `Circuit open for ${this.primaryProvider}`,
    });
  }

  async handlePrimaryError(primaryError, audioData, options) {
    if (!this.hasFallback() || !this.shouldFallback(primaryError)) {
      throw primaryError;
    }

    return await this.transcribeWithFallback(audioData, options, {
      primaryError: primaryError.message,
    });
  }

  async transcribeWithFallback(audioData, options, { primaryError }) {
    const fallbackDecision = await this._circuitBreaker.canRequest(this.fallbackProvider);
    if (!fallbackDecision.allowed) {
      throw createCircuitOpenError(this.fallbackProvider, fallbackDecision);
    }

    try {
      const result = await this.transcribeWithProvider(this.fallbackProvider, audioData, options);
      await this.recordSuccess(this.fallbackProvider);
      return {
        ...result,
        provider: this.fallbackProvider,
        fallbackUsed: true,
        primaryError: primaryError,
      };
    } catch (fallbackError) {
      await this.recordFailure(this.fallbackProvider, fallbackError);
      throw this.buildFallbackError(primaryError, fallbackError);
    }
  }

  buildFallbackError(primaryError, fallbackError) {
    const primaryMessage = typeof primaryError === 'string' ? primaryError : primaryError?.message;
    const fallbackMessage = fallbackError?.message || 'Unknown error';

    return new Error(
      `Transcription failed. Primary (${this.primaryProvider}): ${primaryMessage}. ` +
        `Fallback (${this.fallbackProvider}): ${fallbackMessage}`,
    );
  }

  async transcribeWithProvider(provider, audioData, options) {
    if (provider === TranscriptionProvider.AZURE_SPEECH) {
      return await this.transcribeWithAzureSpeech(audioData, options);
    }

    return await this.transcribeWithWhisper(audioData, options);
  }

  /**
   * Transcribe using Azure Speech
   */
  async transcribeWithAzureSpeech(audioData, options) {
    const language = this.mapLanguageToAzure(options.language);
    return await this.primaryClient.transcribe(audioData, {
      language,
      format: options.format,
    });
  }

  /**
   * Transcribe using OpenAI Whisper
   */
  async transcribeWithWhisper(audioData, options) {
    const client = this.fallbackClient || this.primaryClient;

    // Whisper expects a File object or form data
    const formData = {
      file: audioData,
      model: 'whisper-1',
    };

    if (options.language) {
      formData.language = options.language;
    }

    const response = await client.audio.transcriptions.create(formData);

    return {
      text: response.text,
      language: options.language || 'unknown',
      duration: response.duration,
    };
  }

  /**
   * Determine if fallback should be used
   */
  shouldFallback(error) {
    const errorMessage = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    return FALLBACK_REASONS.some((reason) => errorMessage.includes(reason));
  }

  /**
   * Map ISO 639-1 language codes to Azure format
   */
  mapLanguageToAzure(language) {
    if (!language) return 'en-US';

    const languageMap = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-BR',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      ar: 'ar-SA',
      hi: 'hi-IN',
    };

    return languageMap[language] || `${language}-${language.toUpperCase()}`;
  }
}

/**
 * Create transcription client with configuration
 */
function createTranscriptionClient(config) {
  const { preferredLanguage = 'en-US', circuitBreakerOptions } = config;
  const { primary, fallback } = resolveProviders({
    ...config,
    preferredLanguage,
  });

  if (!primary) {
    throw new Error(
      'No transcription provider available. Configure either Azure Speech or OpenAI Whisper.',
    );
  }

  return new TranscriptionClient({
    primary,
    fallback,
    circuitBreakerOptions,
  });
}

module.exports = {
  TranscriptionClient,
  TranscriptionProvider,
  createTranscriptionClient,
};
