/**
 * Transcription Service Wrapper
 *
 * Provides unified interface for audio transcription with Azure Speech (primary)
 * and OpenAI Whisper (fallback). This wrapper maintains backward compatibility
 * with existing transcribeAudioFile interface.
 *
 * @module services/transcription
 */

const fs = require('fs');
const path = require('path');
const { createTranscriptionClient } = require('../providers/transcriptionFactory');
const {
  AZURE_SPEECH_API_KEY,
  AZURE_SPEECH_REGION,
  AZURE_SPEECH_LANGUAGE,
  OPENAI_API_KEY,
} = require('../config');

let transcriptionClientInstance = null;

/**
 * Get or create transcription client singleton
 */
function getTranscriptionClient() {
  if (!transcriptionClientInstance) {
    transcriptionClientInstance = createTranscriptionClient({
      azureSpeechApiKey: AZURE_SPEECH_API_KEY,
      azureSpeechRegion: AZURE_SPEECH_REGION,
      openaiApiKey: OPENAI_API_KEY,
      preferredLanguage: AZURE_SPEECH_LANGUAGE || 'en-US',
    });
  }
  return transcriptionClientInstance;
}

/**
 * Transcribe audio file with automatic provider selection
 *
 * Maintains backward compatibility with existing interface while using
 * modular provider architecture underneath.
 *
 * @param {Object} options - Transcription options
 * @param {string} options.filePath - Path to audio file
 * @param {string} options.language - Language code (ISO 639-1)
 * @param {number} options.maxRetries - Max retries (default: 3)
 * @returns {Promise<Object>} Transcription response
 */
async function transcribeAudioFile({ filePath, language, maxRetries: _maxRetries = 3 }) {
  if (!filePath) {
    throw new Error('Audio file path is required');
  }

  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  // Check file size
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  // Both Azure Speech and Whisper have size limits (25MB for Whisper, 200MB for Azure Speech)
  if (stats.size > 25 * 1024 * 1024) {
    throw new Error(
      `Audio file too large: ${fileSizeMB.toFixed(
        1,
      )}MB (max 25MB). File should be split into smaller segments.`,
    );
  }

  const filename = path.basename(filePath);
  const format = path.extname(filename).slice(1) || 'wav';

  console.log(`[Transcription] Processing ${fileSizeMB.toFixed(1)}MB audio file: ${filename}`);

  try {
    const startTime = Date.now();
    const client = getTranscriptionClient();

    // Read audio file
    const audioData = fs.readFileSync(filePath);

    // Transcribe with automatic fallback
    const result = await client.transcribe(audioData, {
      language,
      format,
      filename,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const provider = result.provider || 'unknown';
    const fallbackNote = result.fallbackUsed ? ' (fallback used)' : '';

    console.log(`[Transcription] Completed in ${duration}s using ${provider}${fallbackNote}`);

    // Normalize response format to match existing interface
    return normalizeTranscriptionResponse(result);
  } catch (error) {
    let message = 'Transcription failed';
    if (error?.message) {
      message = error.message;
    }

    if (error?.message?.includes('Connection error') || error?.code === 'ECONNREFUSED') {
      message += '. This may be a temporary network issue - please try again.';
    }

    console.error('[Transcription] Failed:', message);
    const wrappedError = new Error(message);
    wrappedError.originalError = error;
    throw wrappedError;
  }
}

/**
 * Normalize transcription response to common format
 *
 * Ensures response matches the format expected by transcriptsService.js
 */
function normalizeTranscriptionResponse(result) {
  // Check if it's a Whisper response (has segments array)
  if (Array.isArray(result.segments)) {
    return result; // Already in correct format
  }

  // Azure Speech response - create compatible format
  return {
    text: result.text || '',
    language: result.language || 'unknown',
    duration: result.duration || 0,
    segments: [], // Azure Speech doesn't provide segments by default
  };
}

module.exports = {
  transcribeAudioFile,
  getTranscriptionClient,
};
