/**
 * Centralised configuration for the Lock-in backend.
 *
 * NOTE:
 * - All environment variable access should go through this module.
 * - This keeps configuration in one place and makes it easier to test.
 */

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
};


