function sanitizeMediaUrlForStorage(mediaUrl) {
  if (!mediaUrl) return '';
  try {
    const url = new URL(mediaUrl);
    url.hash = '';
    url.search = '';
    const segments = url.pathname.split('/').map((segment) => {
      if (!segment) return segment;
      if (segment.length > 32) return '[redacted]';
      return segment;
    });
    url.pathname = segments.join('/');
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeMediaUrlForStorage(mediaUrl) {
  return sanitizeMediaUrlForStorage(mediaUrl);
}

function coerceNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getStartOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

module.exports = {
  sanitizeMediaUrlForStorage,
  normalizeMediaUrlForStorage,
  coerceNumber,
  getStartOfTodayUTC,
};
