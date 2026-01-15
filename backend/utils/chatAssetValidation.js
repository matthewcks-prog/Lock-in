/**
 * Chat Asset Validation
 *
 * Validation utilities for chat message attachments.
 * Supports images (for vision), documents, and code files.
 */

const {
  CHAT_ASSETS_MAX_BYTES,
  ALLOWED_CHAT_ASSET_MIME_TYPES,
  CHAT_ASSET_MIME_GROUPS,
  MIME_EXTENSION_MAP,
} = require('../config');

/**
 * Infer asset type from MIME type
 * @param {string} mimeType
 * @returns {'image'|'document'|'code'|'other'}
 */
function inferChatAssetType(mimeType) {
  const match = Object.entries(CHAT_ASSET_MIME_GROUPS).find(([, mimes]) =>
    mimes.includes(mimeType),
  );
  return match ? match[0] : 'other';
}

/**
 * Get file extension for a MIME type
 * @param {string} mimeType
 * @returns {string}
 */
function getExtensionForMime(mimeType) {
  if (MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  const subtype = mimeType?.split('/')?.[1];
  if (!subtype) return 'bin';

  // Strip any parameters (e.g., "text/plain; charset=utf-8")
  return subtype.split(';')[0];
}

const TEXTUAL_MIME_TYPES = new Set(['application/json']);
const OFFICE_ZIP_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function normalizeMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return '';
  return mimeType.split(';')[0].trim().toLowerCase();
}

function isTextualMime(mimeType) {
  return mimeType.startsWith('text/') || TEXTUAL_MIME_TYPES.has(mimeType);
}

async function detectMagicMimeType(file) {
  if (!file?.buffer) return null;

  const { fileTypeFromBuffer } = await import('file-type');
  return fileTypeFromBuffer(file.buffer);
}

/**
 * Validate a file for chat attachment upload (includes magic bytes validation)
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Validation result
 */
async function validateChatAssetFile(file) {
  if (!file) {
    return { valid: false, reason: 'File is required' };
  }

  if (file.size > CHAT_ASSETS_MAX_BYTES) {
    const maxMB = Math.round(CHAT_ASSETS_MAX_BYTES / (1024 * 1024));
    return {
      valid: false,
      reason: `File exceeds maximum size of ${maxMB}MB`,
    };
  }

  const declaredMimeType = normalizeMimeType(file.mimetype);
  if (!ALLOWED_CHAT_ASSET_MIME_TYPES.includes(declaredMimeType)) {
    return { valid: false, reason: 'File type not allowed' };
  }

  const detected = await detectMagicMimeType(file);
  if (detected) {
    const detectedMime = normalizeMimeType(detected.mime);
    const isOfficeZip =
      detectedMime === 'application/zip' && OFFICE_ZIP_MIME_TYPES.has(declaredMimeType);

    if (!isOfficeZip && detectedMime !== declaredMimeType) {
      return { valid: false, reason: 'File content does not match declared type' };
    }
  } else if (!isTextualMime(declaredMimeType)) {
    return { valid: false, reason: 'Unable to verify file content' };
  }

  const type = inferChatAssetType(declaredMimeType);
  const extension = getExtensionForMime(declaredMimeType);

  return {
    valid: true,
    mimeType: declaredMimeType,
    type,
    extension,
  };
}

/**
 * Check if a MIME type is an image that supports vision analysis
 * @param {string} mimeType
 * @returns {boolean}
 */
function isVisionCompatibleImage(mimeType) {
  const visionMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  return visionMimes.includes(mimeType);
}

module.exports = {
  validateChatAssetFile,
  inferChatAssetType,
  getExtensionForMime,
  isVisionCompatibleImage,
};
