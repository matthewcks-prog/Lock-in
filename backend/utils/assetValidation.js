const {
  NOTE_ASSETS_MAX_BYTES,
  ALLOWED_ASSET_MIME_TYPES,
  NOTE_ASSET_MIME_GROUPS,
  MIME_EXTENSION_MAP,
} = require("../config");

function inferAssetType(mimeType) {
  const match = Object.entries(NOTE_ASSET_MIME_GROUPS).find(([, mimes]) =>
    mimes.includes(mimeType)
  );
  return match ? match[0] : "other";
}

function getExtensionForMime(mimeType) {
  if (MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  const subtype = mimeType?.split("/")?.[1];
  if (!subtype) return "bin";

  // Strip any parameters (e.g., "text/plain; charset=utf-8")
  return subtype.split(";")[0];
}

function validateAssetFile(file) {
  if (!file) {
    return { valid: false, reason: "File is required" };
  }

  if (file.size > NOTE_ASSETS_MAX_BYTES) {
    return {
      valid: false,
      reason: `File exceeds maximum size of ${NOTE_ASSETS_MAX_BYTES} bytes`,
    };
  }

  if (!ALLOWED_ASSET_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, reason: "File type not allowed" };
  }

  const type = inferAssetType(file.mimetype);
  const extension = getExtensionForMime(file.mimetype);

  return {
    valid: true,
    mimeType: file.mimetype,
    type,
    extension,
  };
}

module.exports = {
  validateAssetFile,
  inferAssetType,
  getExtensionForMime,
};
