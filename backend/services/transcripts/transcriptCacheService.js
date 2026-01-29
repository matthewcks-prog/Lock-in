const { ValidationError } = require('../../errors');
const { upsertTranscriptCache } = require('../../repositories/transcriptsRepository');

function coerceNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

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

function normalizeSegment(segment) {
  if (!segment || typeof segment !== 'object') return null;
  const startMs = coerceNumber(segment.startMs);
  if (startMs === null) return null;
  const text = typeof segment.text === 'string' ? segment.text.trim() : '';
  if (!text) return null;

  const endMs = coerceNumber(segment.endMs);
  const speaker = typeof segment.speaker === 'string' ? segment.speaker.trim() : '';
  const confidence = coerceNumber(segment.confidence);

  const normalized = {
    startMs,
    endMs: endMs === null ? null : endMs,
    text,
  };

  if (speaker) {
    normalized.speaker = speaker;
  }
  if (confidence !== null) {
    normalized.confidence = confidence;
  }

  return normalized;
}

function normalizeTranscript(transcript) {
  if (!transcript || typeof transcript !== 'object') {
    throw new ValidationError('Transcript is required', 'transcript');
  }

  const plainText = typeof transcript.plainText === 'string' ? transcript.plainText.trim() : '';
  if (!plainText) {
    throw new ValidationError('Transcript text is required', 'transcript.plainText');
  }

  const segments = Array.isArray(transcript.segments) ? transcript.segments : [];
  const normalizedSegments = segments.map((segment) => normalizeSegment(segment)).filter(Boolean);

  const durationMs = coerceNumber(transcript.durationMs);
  const normalized = {
    plainText,
    segments: normalizedSegments,
  };

  if (durationMs !== null) {
    normalized.durationMs = durationMs;
  }

  return normalized;
}

async function cacheExternalTranscript({ userId, fingerprint, provider, transcript, meta }) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }

  if (!fingerprint || typeof fingerprint !== 'string') {
    throw new ValidationError('Fingerprint is required', 'fingerprint');
  }

  const normalizedProvider = typeof provider === 'string' ? provider.trim() : '';
  if (!normalizedProvider) {
    throw new ValidationError('Provider is required', 'provider');
  }

  const normalizedTranscript = normalizeTranscript(transcript);
  const metaValue = meta && typeof meta === 'object' ? meta : {};

  const rawMediaUrl = typeof metaValue.mediaUrl === 'string' ? metaValue.mediaUrl : '';
  const rawNormalizedUrl =
    typeof metaValue.mediaUrlNormalized === 'string' ? metaValue.mediaUrlNormalized : rawMediaUrl;

  const mediaUrlRedacted = sanitizeMediaUrlForStorage(rawMediaUrl);
  const mediaUrlNormalized = normalizeMediaUrlForStorage(rawNormalizedUrl);
  const etag = typeof metaValue.etag === 'string' ? metaValue.etag : null;
  const lastModified = typeof metaValue.lastModified === 'string' ? metaValue.lastModified : null;
  const durationMs = coerceNumber(metaValue.durationMs ?? normalizedTranscript.durationMs);

  return upsertTranscriptCache({
    userId,
    fingerprint: fingerprint.trim(),
    provider: normalizedProvider,
    mediaUrlRedacted,
    mediaUrlNormalized,
    etag,
    lastModified,
    durationMs,
    transcriptJson: normalizedTranscript,
  });
}

module.exports = {
  cacheExternalTranscript,
};
