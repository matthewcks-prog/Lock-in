/**
 * Centralised configuration for the Lock-in backend.
 *
 * NOTE:
 * - All environment variable access should go through this module.
 * - This keeps configuration in one place and makes it easier to test.
 */

const path = require('path');
const chatLimits = require('../core/config/chatLimits.json');

// =============================================================================
// Environment Selection & Supabase Configuration
// =============================================================================

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

/**
 * Get environment-aware Supabase configuration.
 *
 * Environment isolation:
 * - Production: Uses SUPABASE_URL_PROD and SUPABASE_SERVICE_ROLE_KEY_PROD
 * - Development/Staging: Uses SUPABASE_URL_DEV and SUPABASE_SERVICE_ROLE_KEY_DEV
 *
 * No fallbacks to legacy vars - fail fast if vars are misconfigured.
 * Validation is handled by utils/validateEnv.js at startup.
 */
function getSupabaseConfig() {
  if (IS_PRODUCTION) {
    return {
      url: process.env.SUPABASE_URL_PROD,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
      anonKey: process.env.SUPABASE_ANON_KEY_PROD,
      environment: 'production',
    };
  }

  // Development or staging
  return {
    url: process.env.SUPABASE_URL_DEV,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_DEV,
    anonKey: process.env.SUPABASE_ANON_KEY_DEV,
    environment: 'development',
  };
}

const SUPABASE_CONFIG = getSupabaseConfig();

const PORT = process.env.PORT || 3000;

// Request/body limits
const MAX_SELECTION_LENGTH = 5000;
const MAX_USER_MESSAGE_LENGTH = 1500;

// Per-user rate limiting (requests per UTC day)
const DAILY_REQUEST_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT, 10) || 100;

function readNumber(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return fallback;
}

// Chat list limits
const DEFAULT_CHAT_LIST_LIMIT = readNumber(
  process.env.CHAT_LIST_LIMIT,
  chatLimits.DEFAULT_CHAT_LIST_LIMIT,
);
const MAX_CHAT_LIST_LIMIT = readNumber(
  process.env.MAX_CHAT_LIST_LIMIT,
  chatLimits.MAX_CHAT_LIST_LIMIT,
);

// CORS configuration – in production prefer an explicit allow‑list
const ALLOWED_ORIGINS = [
  // Chrome extensions
  /^chrome-extension:\/\//,
  // Local development
  /localhost/,
  // Monash learning environment (e.g. https://learning.monash.edu)
  /^https:\/\/learning\.monash\.edu$/,
  // Panopto (all regional domains, including multi-subdomain like monash.au.panopto.com)
  /^https:\/\/([a-z0-9.-]+\.)?panopto\.(com|eu)$/,
  // Echo360 (regional + QA domains)
  /^https:\/\/([a-z0-9-]+\.)?echo360qa\.(org|dev)$/,
  /^https:\/\/([a-z0-9-]+\.)?echo360\.(org|org\.au|net\.au|ca|org\.uk)$/,
];

// Asset uploads (notes)
const NOTE_ASSETS_BUCKET = process.env.NOTE_ASSETS_BUCKET || 'note-assets';
const NOTE_ASSETS_MAX_BYTES = parseInt(process.env.NOTE_ASSETS_MAX_BYTES, 10) || 10 * 1024 * 1024; // 10MB default

// Chat asset uploads
const CHAT_ASSETS_BUCKET = process.env.CHAT_ASSETS_BUCKET || 'chat-assets';
const CHAT_ASSETS_MAX_BYTES = parseInt(process.env.CHAT_ASSETS_MAX_BYTES, 10) || 10 * 1024 * 1024; // 10MB default
const CHAT_ASSET_DAILY_UPLOAD_LIMIT = parseInt(process.env.CHAT_ASSET_DAILY_UPLOAD_LIMIT, 10) || 50;
const CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT =
  parseInt(process.env.CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT, 10) || 100 * 1024 * 1024;
const CHAT_ASSET_SIGNED_URL_TTL_SECONDS =
  parseInt(process.env.CHAT_ASSET_SIGNED_URL_TTL_SECONDS, 10) || 10 * 60;

// MIME allow-list grouped by asset category for easy extension
const NOTE_ASSET_MIME_GROUPS = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  document: [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  audio: [],
  video: [],
  other: [],
};

// Chat assets support additional code file types
const CHAT_ASSET_MIME_GROUPS = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  document: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  code: [
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    'text/css',
    'text/html',
    'application/json',
    'text/x-rust',
    'text/x-go',
  ],
  other: [],
};

const ALLOWED_ASSET_MIME_TYPES = Object.values(NOTE_ASSET_MIME_GROUPS).flat();
const ALLOWED_CHAT_ASSET_MIME_TYPES = Object.values(CHAT_ASSET_MIME_GROUPS).flat();

// =============================================================================
// LLM Provider Configuration
// =============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_EMBEDDINGS_MODEL = process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small';
const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1';
const OPENAI_FALLBACK_ENABLED = readBoolean(
  process.env.OPENAI_FALLBACK_ENABLED,
  Boolean(OPENAI_API_KEY),
);

const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';
const AZURE_OPENAI_CHAT_DEPLOYMENT =
  process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT =
  process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
const AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT = process.env.AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT;

// Azure Speech-to-Text Configuration (Primary transcription service)
const AZURE_SPEECH_API_KEY = process.env.AZURE_SPEECH_API_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'australiaeast';
const AZURE_SPEECH_LANGUAGE = process.env.AZURE_SPEECH_LANGUAGE || 'en-US';

function isAzureEnabled() {
  return Boolean(AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT);
}

function isOpenAIEnabled() {
  return Boolean(OPENAI_API_KEY);
}

function isOpenAIFallbackEnabled() {
  return OPENAI_FALLBACK_ENABLED && isOpenAIEnabled();
}

function isAzureSpeechEnabled() {
  return Boolean(AZURE_SPEECH_API_KEY && AZURE_SPEECH_REGION);
}

function isAzureEmbeddingsEnabled() {
  return Boolean(
    AZURE_OPENAI_API_KEY &&
    AZURE_OPENAI_ENDPOINT &&
    AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT
  );
}

function getDeployment(type, provider = isAzureEnabled() ? 'azure' : 'openai') {
  const deployments = {
    openai: {
      chat: OPENAI_MODEL,
      embeddings: OPENAI_EMBEDDINGS_MODEL,
      transcription: OPENAI_TRANSCRIPTION_MODEL,
    },
    azure: {
      chat: AZURE_OPENAI_CHAT_DEPLOYMENT || OPENAI_MODEL,
      embeddings: AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || OPENAI_EMBEDDINGS_MODEL,
      transcription: AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT || OPENAI_TRANSCRIPTION_MODEL,
    },
  };

  const providerKey = provider === 'azure' ? 'azure' : 'openai';
  const deployment = deployments[providerKey]?.[type];

  if (!deployment) {
    throw new Error(`Unknown deployment type "${type}" for provider "${providerKey}"`);
  }

  return deployment;
}

function validateAzureOpenAIConfig() {
  if (!isAzureEnabled()) {
    return;
  }

  const missing = [];
  if (!AZURE_OPENAI_CHAT_DEPLOYMENT) missing.push('AZURE_OPENAI_CHAT_DEPLOYMENT');
  if (!AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT) missing.push('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT');
  if (!AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT) missing.push('AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT');

  if (missing.length > 0) {
    console.warn(
      '[config] Azure OpenAI enabled, but deployment names are missing. Defaulting to OpenAI model names:',
      missing.join(', '),
    );
  }
}

if (OPENAI_FALLBACK_ENABLED && !OPENAI_API_KEY) {
  console.warn('[config] OPENAI_FALLBACK_ENABLED is set but OPENAI_API_KEY is missing.');
}

validateAzureOpenAIConfig();

// Transcript processing
const TRANSCRIPTION_MODEL = OPENAI_TRANSCRIPTION_MODEL;
const TRANSCRIPTION_SEGMENT_MAX_MB = parseInt(process.env.TRANSCRIPTION_SEGMENT_MAX_MB, 10) || 24;
const TRANSCRIPTION_TEMP_DIR =
  process.env.TRANSCRIPTION_TEMP_DIR || path.join(__dirname, 'tmp', 'transcripts');
const TRANSCRIPT_CHUNK_MAX_BYTES =
  parseInt(process.env.TRANSCRIPT_CHUNK_MAX_BYTES, 10) || 8 * 1024 * 1024;
const TRANSCRIPT_DAILY_JOB_LIMIT = parseInt(process.env.TRANSCRIPT_DAILY_JOB_LIMIT, 10) || 20;
const TRANSCRIPT_MAX_CONCURRENT_JOBS =
  parseInt(process.env.TRANSCRIPT_MAX_CONCURRENT_JOBS, 10) || 3;
const TRANSCRIPT_MAX_TOTAL_BYTES =
  parseInt(process.env.TRANSCRIPT_MAX_TOTAL_BYTES, 10) || 512 * 1024 * 1024;
const TRANSCRIPT_MAX_DURATION_MINUTES =
  parseInt(process.env.TRANSCRIPT_MAX_DURATION_MINUTES, 10) || 180;
// Rate limit for chunk uploads: 512MB/minute allows reasonable upload speed
// while still providing abuse protection (enforced per-user per-minute window)
const TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE =
  parseInt(process.env.TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE, 10) || 512 * 1024 * 1024;
const TRANSCRIPT_JOB_TTL_MINUTES = parseInt(process.env.TRANSCRIPT_JOB_TTL_MINUTES, 10) || 60;
const TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES =
  parseInt(process.env.TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES, 10) || 10;

// Preferred extensions for common MIME types (fallback to subtype if missing)
const MIME_EXTENSION_MAP = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'text/typescript': 'ts',
  'text/x-python': 'py',
  'text/x-java': 'java',
  'text/x-c': 'c',
  'text/x-c++': 'cpp',
  'text/css': 'css',
  'text/html': 'html',
  'application/json': 'json',
  'text/x-rust': 'rs',
  'text/x-go': 'go',
};

function isOriginAllowed(origin) {
  if (!origin) {
    // Allow non-browser clients (health checks, local tools, etc.)
    return true;
  }

  return ALLOWED_ORIGINS.some((pattern) =>
    typeof pattern === 'string' ? origin === pattern : pattern.test(origin),
  );
}

module.exports = {
  // Environment
  NODE_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,

  // Supabase Configuration
  SUPABASE_CONFIG,
  SUPABASE_URL: SUPABASE_CONFIG.url,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_CONFIG.serviceRoleKey,
  SUPABASE_ANON_KEY: SUPABASE_CONFIG.anonKey,

  // Server
  PORT,
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
  DEFAULT_CHAT_LIST_LIMIT,
  MAX_CHAT_LIST_LIMIT,
  isOriginAllowed,

  // Note Assets
  NOTE_ASSETS_BUCKET,
  NOTE_ASSETS_MAX_BYTES,
  NOTE_ASSET_MIME_GROUPS,
  ALLOWED_ASSET_MIME_TYPES,

  // Chat Assets
  CHAT_ASSETS_BUCKET,
  CHAT_ASSETS_MAX_BYTES,
  CHAT_ASSET_DAILY_UPLOAD_LIMIT,
  CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
  CHAT_ASSET_SIGNED_URL_TTL_SECONDS,
  CHAT_ASSET_MIME_GROUPS,
  ALLOWED_CHAT_ASSET_MIME_TYPES,
  MIME_EXTENSION_MAP,

  // LLM Providers
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_EMBEDDINGS_MODEL,
  OPENAI_TRANSCRIPTION_MODEL,
  OPENAI_FALLBACK_ENABLED,
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_CHAT_DEPLOYMENT,
  AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
  AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT,
  isAzureEnabled,
  isOpenAIEnabled,
  isOpenAIFallbackEnabled,
  isAzureSpeechEnabled,
  isAzureEmbeddingsEnabled,
  getDeployment,

  // Azure Speech Configuration
  AZURE_SPEECH_API_KEY,
  AZURE_SPEECH_REGION,
  AZURE_SPEECH_LANGUAGE,

  // Transcripts
  TRANSCRIPTION_MODEL,
  TRANSCRIPTION_SEGMENT_MAX_MB,
  TRANSCRIPTION_TEMP_DIR,
  TRANSCRIPT_CHUNK_MAX_BYTES,
  TRANSCRIPT_DAILY_JOB_LIMIT,
  TRANSCRIPT_MAX_CONCURRENT_JOBS,
  TRANSCRIPT_MAX_TOTAL_BYTES,
  TRANSCRIPT_MAX_DURATION_MINUTES,
  TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE,
  TRANSCRIPT_JOB_TTL_MINUTES,
  TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES,
};
