/**
 * Azure Speech-to-Text Client
 *
 * Provides speech-to-text transcription using Azure Cognitive Services Speech API.
 * This is the primary transcription service when available, leveraging Azure credits.
 *
 * Features:
 * - Supports multiple audio formats (wav, mp3, ogg, webm)
 * - Language detection or explicit language specification
 * - Handles file uploads and streaming
 *
 * @module providers/azureSpeechClient
 */

const axios = require('axios');
const { TEN, THOUSAND, SIXTY } = require('../constants/numbers');
const HTTP_STATUS = require('../constants/httpStatus');

const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_FORMAT = 'wav';
const DEFAULT_TIMEOUT_MS = SIXTY * THOUSAND;
const TICKS_PER_SECOND = TEN * THOUSAND * THOUSAND;
const SILENCE_WAV_HEADER = Buffer.from('RIFF$\u0000\u0000\u0000', 'latin1');

/**
 * Azure Speech service configuration
 */
class AzureSpeechConfig {
  constructor({ apiKey, region, language = DEFAULT_LANGUAGE }) {
    if (!apiKey) {
      throw new Error('AZURE_SPEECH_API_KEY is required');
    }
    if (!region) {
      throw new Error('AZURE_SPEECH_REGION is required');
    }

    this.apiKey = apiKey;
    this.region = region;
    this.language = language;
    this.endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
  }

  getEndpoint(language) {
    const lang = language || this.language;
    return `${this.endpoint}?language=${lang}`;
  }
}

/**
 * Azure Speech-to-Text client
 */
class AzureSpeechClient {
  constructor(config) {
    this.config = config;
  }

  /**
   * Transcribe audio file to text
   *
   * @param {Buffer|Stream} audioData - Audio file data
   * @param {Object} options - Transcription options
   * @param {string} options.language - Language code (e.g., 'en-US', 'es-ES')
   * @param {string} options.format - Audio format ('wav', 'mp3', 'ogg')
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    const language = options.language || this.config.language;
    const format = options.format || DEFAULT_FORMAT;

    try {
      const response = await axios.post(this.config.getEndpoint(language), audioData, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
          'Content-Type': this.getContentType(format),
          Accept: 'application/json',
        },
        maxBodyLength: Infinity,
        timeout: DEFAULT_TIMEOUT_MS, // 60 second timeout
      });

      return this.parseResponse(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get content type for audio format
   */
  getContentType(format) {
    const contentTypes = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
    };

    return contentTypes[format] || 'audio/wav';
  }

  /**
   * Parse Azure Speech API response
   */
  parseResponse(data) {
    if (!data) {
      throw new Error('Empty response from Azure Speech API');
    }

    // Azure Speech API returns { RecognitionStatus, DisplayText, Offset, Duration }
    if (data.RecognitionStatus === 'Success') {
      return {
        text: data.DisplayText || '',
        language: data.Language,
        duration: data.Duration / TICKS_PER_SECOND, // Convert from ticks to seconds
        confidence: data.Confidence,
      };
    }

    throw new Error(`Azure Speech recognition failed: ${data.RecognitionStatus}`);
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;

      // Quota exceeded or rate limit
      if (status === HTTP_STATUS.TOO_MANY_REQUESTS) {
        return new Error('Azure Speech quota exceeded or rate limited');
      }

      // Authentication errors
      if (status === HTTP_STATUS.UNAUTHORIZED || status === HTTP_STATUS.FORBIDDEN) {
        return new Error('Azure Speech authentication failed: Invalid API key or region');
      }

      // Service errors
      if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        return new Error(`Azure Speech service error: ${message}`);
      }

      return new Error(`Azure Speech API error (${status}): ${message}`);
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new Error('Azure Speech request timeout');
    }

    return new Error(`Azure Speech error: ${error.message}`);
  }

  /**
   * Check if Azure Speech service is available
   */
  async healthCheck() {
    try {
      // Simple health check with minimal audio data
      await this.transcribe(SILENCE_WAV_HEADER, { format: DEFAULT_FORMAT });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create Azure Speech client from config
 */
function createAzureSpeechClient(apiKey, region, language) {
  const config = new AzureSpeechConfig({ apiKey, region, language });
  return new AzureSpeechClient(config);
}

module.exports = {
  AzureSpeechClient,
  AzureSpeechConfig,
  createAzureSpeechClient,
};
