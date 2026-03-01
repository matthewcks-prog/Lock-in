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
const { createTranscriptionClient } = require('../../providers/transcriptionFactory');
const {
  AZURE_SPEECH_API_KEY,
  AZURE_SPEECH_REGION,
  AZURE_SPEECH_LANGUAGE,
  OPENAI_API_KEY,
} = require('../../config');

const DEFAULT_TRANSCRIPTION_LANGUAGE = 'en-US';
const DEFAULT_MAX_RETRIES = 3;
const TWO = 2;
const TEN = 10;
const BYTES_PER_MEGABYTE = (TWO ** TEN) ** TWO;
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * BYTES_PER_MEGABYTE;
const TIMING_PRECISION = 1;

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
      preferredLanguage: AZURE_SPEECH_LANGUAGE || DEFAULT_TRANSCRIPTION_LANGUAGE,
    });
  }
  return transcriptionClientInstance;
}

function ensureFilePath(filePath) {
  if (!filePath) {
    throw new Error('Audio file path is required');
  }
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
}

function getFileSizeStats(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / BYTES_PER_MEGABYTE;
  return { stats, fileSizeMB };
}

function ensureFileSizeAllowed(stats, fileSizeMB) {
  if (stats.size <= MAX_FILE_SIZE_BYTES) {
    return;
  }
  throw new Error(
    `Audio file too large: ${fileSizeMB.toFixed(
      TIMING_PRECISION,
    )}MB (max ${MAX_FILE_SIZE_MB}MB). File should be split into smaller segments.`,
  );
}

function getFileMetadata(filePath) {
  const filename = path.basename(filePath);
  const format = path.extname(filename).slice(1) || 'wav';
  return { filename, format };
}

function readAudioData(filePath) {
  const audioData = fs.readFileSync(filePath);
  return audioData;
}

function logTranscriptionStart(fileSizeMB, filename) {
  console.log(
    `[Transcription] Processing ${fileSizeMB.toFixed(TIMING_PRECISION)}MB audio file: ${filename}`,
  );
}

function logTranscriptionSuccess({ startTime, result }) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(TIMING_PRECISION);
  const provider = result.provider || 'unknown';
  const fallbackNote = result.fallbackUsed ? ' (fallback used)' : '';
  console.log(`[Transcription] Completed in ${duration}s using ${provider}${fallbackNote}`);
}

function buildTranscriptionError(error) {
  let message = error?.message || 'Transcription failed';
  if (error?.message?.includes('Connection error') || error?.code === 'ECONNREFUSED') {
    message += '. This may be a temporary network issue - please try again.';
  }

  console.error('[Transcription] Failed:', message);
  const wrappedError = new Error(message);
  wrappedError.originalError = error;
  return wrappedError;
}

async function transcribeWithClient({ filePath, language }) {
  const client = getTranscriptionClient();
  const startTime = Date.now();
  const { filename, format } = getFileMetadata(filePath);
  const audioData = readAudioData(filePath);

  const result = await client.transcribe(audioData, {
    language,
    format,
    filename,
  });
  logTranscriptionSuccess({ startTime, result });
  return result;
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
 * @param {number} options.maxRetries - Max retries (default: DEFAULT_MAX_RETRIES)
 * @returns {Promise<Object>} Transcription response
 */
async function transcribeAudioFile({
  filePath,
  language,
  maxRetries: _maxRetries = DEFAULT_MAX_RETRIES,
}) {
  ensureFilePath(filePath);
  ensureFileExists(filePath);

  const { stats, fileSizeMB } = getFileSizeStats(filePath);
  ensureFileSizeAllowed(stats, fileSizeMB);

  const { filename } = getFileMetadata(filePath);
  logTranscriptionStart(fileSizeMB, filename);

  try {
    const result = await transcribeWithClient({ filePath, language });
    return normalizeTranscriptionResponse(result);
  } catch (error) {
    throw buildTranscriptionError(error);
  }
}

/**
 * Normalize transcription response to common format
 *
 * Ensures response matches the format expected by transcriptsService.js
 */
function normalizeTranscriptionResponse(result) {
  if (Array.isArray(result.segments)) {
    return result;
  }

  return {
    text: result.text || '',
    language: result.language || 'unknown',
    duration: result.duration || 0,
    segments: [],
  };
}

module.exports = {
  transcribeAudioFile,
  getTranscriptionClient,
};
