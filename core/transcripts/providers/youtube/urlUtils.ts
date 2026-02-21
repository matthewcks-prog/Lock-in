/**
 * YouTube URL Utilities
 *
 * Parse and detect YouTube URLs in various formats:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/embed/ID
 * - youtube-nocookie.com/embed/ID
 * - youtube.com/shorts/ID
 */

const YOUTUBE_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
];

const VIDEO_ID_REGEX = /^[\w-]{11}$/;

export type YouTubeInfo = {
  videoId: string;
  embedUrl: string;
};

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isYouTubeDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return YOUTUBE_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

export function isYouTubeUrl(url: string): boolean {
  const parsed = tryParseUrl(url);
  if (parsed === null) return false;
  return isYouTubeDomain(parsed.hostname);
}

function extractVideoIdFromWatchUrl(url: URL): string | null {
  const v = url.searchParams.get('v');
  if (v !== null && VIDEO_ID_REGEX.test(v)) return v;
  return null;
}

function extractVideoIdFromPath(url: URL): string | null {
  const pathSegments = url.pathname.split('/').filter((s) => s.length > 0);

  // /embed/VIDEO_ID or /shorts/VIDEO_ID or /v/VIDEO_ID or /live/VIDEO_ID
  const prefixes = ['embed', 'shorts', 'v', 'live'];
  for (const prefix of prefixes) {
    const idx = pathSegments.indexOf(prefix);
    if (idx !== -1) {
      const candidate = pathSegments[idx + 1];
      if (candidate !== undefined && VIDEO_ID_REGEX.test(candidate)) return candidate;
    }
  }

  return null;
}

function extractVideoIdFromShortUrl(url: URL): string | null {
  // youtu.be/VIDEO_ID
  if (url.hostname === 'youtu.be') {
    const candidate = url.pathname.slice(1);
    if (VIDEO_ID_REGEX.test(candidate)) return candidate;
  }
  return null;
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const url = tryParseUrl(rawUrl);
  if (url === null) return null;
  if (!isYouTubeDomain(url.hostname)) return null;

  return (
    extractVideoIdFromWatchUrl(url) ??
    extractVideoIdFromShortUrl(url) ??
    extractVideoIdFromPath(url)
  );
}

export function extractYouTubeInfo(rawUrl: string): YouTubeInfo | null {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (videoId === null) return null;
  return {
    videoId,
    embedUrl: buildYouTubeEmbedUrl(videoId),
  };
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
