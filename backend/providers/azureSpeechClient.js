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
const FormData = require('form-data');

/**
 * Azure Speech service configuration
 */
class AzureSpeechConfig {
  constructor({ apiKey, region, language = 'en-US' }) {
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
    const format = options.format || 'wav';

    try {
      const response = await axios.post(this.config.getEndpoint(language), audioData, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
          'Content-Type': this.getContentType(format),
          Accept: 'application/json',
        },
        maxBodyLength: Infinity,
        timeout: 60000, // 60 second timeout
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
        duration: data.Duration / 10000000, // Convert from ticks to seconds
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
      if (status === 429) {
        return new Error('Azure Speech quota exceeded or rate limited');
      }

      // Authentication errors
      if (status === 401 || status === 403) {
        return new Error('Azure Speech authentication failed: Invalid API key or region');
      }

      // Service errors
      if (status >= 500) {
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
      const silenceBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]);
      await this.transcribe(silenceBuffer, { format: 'wav' });
      return true;
    } catch (error) {
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
