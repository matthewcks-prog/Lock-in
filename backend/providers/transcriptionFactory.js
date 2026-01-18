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

/**
 * Transcription provider types
 */
const TranscriptionProvider = {
  AZURE_SPEECH: 'azure-speech',
  OPENAI_WHISPER: 'openai-whisper',
};

/**
 * Create OpenAI Whisper client
 */
function createWhisperClient(apiKey) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for Whisper fallback');
  }
  return new OpenAI({ apiKey });
}

/**
 * Unified transcription interface
 */
class TranscriptionClient {
  constructor(primaryClient, primaryProvider, fallbackClient, fallbackProvider) {
    this.primaryClient = primaryClient;
    this.primaryProvider = primaryProvider;
    this.fallbackClient = fallbackClient;
    this.fallbackProvider = fallbackProvider;
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
    try {
      // Try primary provider (Azure Speech)
      if (this.primaryProvider === TranscriptionProvider.AZURE_SPEECH) {
        const result = await this.transcribeWithAzureSpeech(audioData, options);
        return {
          ...result,
          provider: this.primaryProvider,
        };
      }

      // Try Whisper
      const result = await this.transcribeWithWhisper(audioData, options);
      return {
        ...result,
        provider: this.primaryProvider,
      };
    } catch (primaryError) {
      // If primary fails, try fallback
      if (this.fallbackClient && this.shouldFallback(primaryError)) {
        try {
          const result = await this.transcribeWithWhisper(audioData, options);
          return {
            ...result,
            provider: this.fallbackProvider,
            fallbackUsed: true,
            primaryError: primaryError.message,
          };
        } catch (fallbackError) {
          // Both failed
          throw new Error(
            `Transcription failed. Primary (${this.primaryProvider}): ${primaryError.message}. ` +
            `Fallback (${this.fallbackProvider}): ${fallbackError.message}`
          );
        }
      }

      // No fallback or shouldn't fallback
      throw primaryError;
    }
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
  const {
    azureSpeechApiKey,
    azureSpeechRegion,
    openaiApiKey,
    preferredLanguage = 'en-US',
  } = config;

  let primaryClient = null;
  let primaryProvider = null;
  let fallbackClient = null;
  let fallbackProvider = null;

  // Try to create Azure Speech client (primary)
  if (azureSpeechApiKey && azureSpeechRegion) {
    try {
      primaryClient = createAzureSpeechClient(
        azureSpeechApiKey,
        azureSpeechRegion,
        preferredLanguage
      );
      primaryProvider = TranscriptionProvider.AZURE_SPEECH;
    } catch (error) {
      console.warn('Failed to create Azure Speech client:', error.message);
    }
  }

  // Create OpenAI Whisper client (fallback or primary if Azure unavailable)
  if (openaiApiKey) {
    try {
      const whisperClient = createWhisperClient(openaiApiKey);
      
      if (primaryClient) {
        // Use as fallback
        fallbackClient = whisperClient;
        fallbackProvider = TranscriptionProvider.OPENAI_WHISPER;
      } else {
        // Use as primary
        primaryClient = whisperClient;
        primaryProvider = TranscriptionProvider.OPENAI_WHISPER;
      }
    } catch (error) {
      console.warn('Failed to create OpenAI Whisper client:', error.message);
    }
  }

  if (!primaryClient) {
    throw new Error(
      'No transcription provider available. Configure either Azure Speech or OpenAI Whisper.'
    );
  }

  return new TranscriptionClient(
    primaryClient,
    primaryProvider,
    fallbackClient,
    fallbackProvider
  );
}

module.exports = {
  TranscriptionClient,
  TranscriptionProvider,
  createTranscriptionClient,
};
