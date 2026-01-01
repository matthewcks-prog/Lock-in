/**
 * Centralised configuration for the Lock-in backend.
 *
 * NOTE:
 * - All environment variable access should go through this module.
 * - This keeps configuration in one place and makes it easier to test.
 */

const path = require("path");

const PORT = process.env.PORT || 3000;

// Request/body limits
const MAX_SELECTION_LENGTH = 5000;
const MAX_USER_MESSAGE_LENGTH = 1500;

// Per-user rate limiting (requests per UTC day)
const DAILY_REQUEST_LIMIT =
  parseInt(process.env.DAILY_REQUEST_LIMIT, 10) || 100;

// Number of chats returned in the sidebar by default``
const DEFAULT_CHAT_LIST_LIMIT =
  parseInt(process.env.CHAT_LIST_LIMIT, 10) || 5;

// CORS configuration – in production prefer an explicit allow‑list
const ALLOWED_ORIGINS = [
  // Chrome extensions
  /^chrome-extension:\/\//,
  // Local development
  /localhost/,
  // Monash learning environment (e.g. https://learning.monash.edu)
  /^https:\/\/learning\.monash\.edu$/,
  // Panopto (all regional domains)
  /^https:\/\/([a-z0-9-]+\.)?panopto\.(com|eu)$/,
  // Echo360 (regional + QA domains)
  /^https:\/\/([a-z0-9-]+\.)?echo360qa\.(org|dev)$/,
  /^https:\/\/([a-z0-9-]+\.)?echo360\.(org|org\.au|net\.au|ca|org\.uk)$/,
];

// Asset uploads (notes)
const NOTE_ASSETS_BUCKET = process.env.NOTE_ASSETS_BUCKET || "note-assets";
const NOTE_ASSETS_MAX_BYTES =
  parseInt(process.env.NOTE_ASSETS_MAX_BYTES, 10) || 10 * 1024 * 1024; // 10MB default

// MIME allow-list grouped by asset category for easy extension
const NOTE_ASSET_MIME_GROUPS = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  document: [
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  audio: [],
  video: [],
  other: [],
};

const ALLOWED_ASSET_MIME_TYPES = Object.values(NOTE_ASSET_MIME_GROUPS).flat();

// Transcript processing
const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";
const TRANSCRIPTION_SEGMENT_MAX_MB =
  parseInt(process.env.TRANSCRIPTION_SEGMENT_MAX_MB, 10) || 24;
const TRANSCRIPTION_TEMP_DIR =
  process.env.TRANSCRIPTION_TEMP_DIR ||
  path.join(__dirname, "tmp", "transcripts");
const TRANSCRIPT_CHUNK_MAX_BYTES =
  parseInt(process.env.TRANSCRIPT_CHUNK_MAX_BYTES, 10) ||
  8 * 1024 * 1024;
const TRANSCRIPT_DAILY_JOB_LIMIT =
  parseInt(process.env.TRANSCRIPT_DAILY_JOB_LIMIT, 10) || 20;
const TRANSCRIPT_MAX_CONCURRENT_JOBS =
  parseInt(process.env.TRANSCRIPT_MAX_CONCURRENT_JOBS, 10) || 3;
const TRANSCRIPT_MAX_TOTAL_BYTES =
  parseInt(process.env.TRANSCRIPT_MAX_TOTAL_BYTES, 10) || 512 * 1024 * 1024;
const TRANSCRIPT_MAX_DURATION_MINUTES =
  parseInt(process.env.TRANSCRIPT_MAX_DURATION_MINUTES, 10) || 180;
// Rate limit for chunk uploads: 512MB/minute allows reasonable upload speed
// while still providing abuse protection (enforced per-user per-minute window)
const TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE =
  parseInt(process.env.TRANSCRIPT_UPLOAD_BYTES_PER_MINUTE, 10) ||
  512 * 1024 * 1024;
const TRANSCRIPT_JOB_TTL_MINUTES =
  parseInt(process.env.TRANSCRIPT_JOB_TTL_MINUTES, 10) || 60;
const TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES =
  parseInt(process.env.TRANSCRIPT_JOB_REAPER_INTERVAL_MINUTES, 10) || 10;

// Preferred extensions for common MIME types (fallback to subtype if missing)
const MIME_EXTENSION_MAP = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isOriginAllowed(origin) {
  if (!origin) {
    // Allow non-browser clients (health checks, local tools, etc.)
    return true;
  }

  return ALLOWED_ORIGINS.some((pattern) =>
    typeof pattern === "string" ? origin === pattern : pattern.test(origin)
  );
}

module.exports = {
  PORT,
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
  DEFAULT_CHAT_LIST_LIMIT,
  isOriginAllowed,
  NOTE_ASSETS_BUCKET,
  NOTE_ASSETS_MAX_BYTES,
  NOTE_ASSET_MIME_GROUPS,
  ALLOWED_ASSET_MIME_TYPES,
  MIME_EXTENSION_MAP,
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
