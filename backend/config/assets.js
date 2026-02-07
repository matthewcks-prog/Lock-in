const { readNumber } = require('./utils');
const { FIFTY, HUNDRED, SIXTY, TEN } = require('../constants/numbers');
const { MEBIBYTE } = require('./units');

// Asset uploads (notes)
const NOTE_ASSETS_BUCKET = process.env.NOTE_ASSETS_BUCKET || 'note-assets';
const NOTE_ASSETS_MAX_BYTES = readNumber(process.env.NOTE_ASSETS_MAX_BYTES, TEN * MEBIBYTE);

// Chat asset uploads
const CHAT_ASSETS_BUCKET = process.env.CHAT_ASSETS_BUCKET || 'chat-assets';
const CHAT_ASSETS_MAX_BYTES = readNumber(process.env.CHAT_ASSETS_MAX_BYTES, TEN * MEBIBYTE);
const CHAT_ASSET_DAILY_UPLOAD_LIMIT = readNumber(process.env.CHAT_ASSET_DAILY_UPLOAD_LIMIT, FIFTY);
const CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT = readNumber(
  process.env.CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
  HUNDRED * MEBIBYTE,
);
const CHAT_ASSET_SIGNED_URL_TTL_SECONDS = readNumber(
  process.env.CHAT_ASSET_SIGNED_URL_TTL_SECONDS,
  TEN * SIXTY,
);

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

module.exports = {
  NOTE_ASSETS_BUCKET,
  NOTE_ASSETS_MAX_BYTES,
  NOTE_ASSET_MIME_GROUPS,
  ALLOWED_ASSET_MIME_TYPES,
  CHAT_ASSETS_BUCKET,
  CHAT_ASSETS_MAX_BYTES,
  CHAT_ASSET_DAILY_UPLOAD_LIMIT,
  CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
  CHAT_ASSET_SIGNED_URL_TTL_SECONDS,
  CHAT_ASSET_MIME_GROUPS,
  ALLOWED_CHAT_ASSET_MIME_TYPES,
  MIME_EXTENSION_MAP,
};
