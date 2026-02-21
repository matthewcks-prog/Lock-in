/**
 * YouTube Caption Extraction
 *
 * Extracts caption track URLs from YouTube video data.
 * Supports multiple strategies:
 * 1. Direct timedtext API (most reliable from service workers)
 * 2. ytInitialPlayerResponse parsing from watch page HTML
 * 3. Direct "captionTracks" marker search in HTML
 */

import type { TranscriptResult, TranscriptSegment } from '../../types';

const MILLISECONDS_PER_SECOND = 1000;

export type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  name?: { simpleText?: string } | undefined;
  kind?: string | undefined;
};

type CaptionListResult = {
  tracks: CaptionTrack[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Direct timedtext API URLs
// ─────────────────────────────────────────────────────────────────────────────

const TIMEDTEXT_LANGUAGES = ['en', 'en-US', 'en-GB', 'en-AU'];

/**
 * Build timedtext API URLs to try for a video.
 * YouTube's timedtext API returns XML captions directly.
 */
export function buildTimedtextUrls(videoId: string): string[] {
  const urls: string[] = [];
  for (const lang of TIMEDTEXT_LANGUAGES) {
    urls.push(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`);
  }
  // Also try auto-generated captions
  for (const lang of TIMEDTEXT_LANGUAGES) {
    urls.push(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr`);
  }
  return urls;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML-based caption track extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a JSON array starting at `startIndex` in `text` by counting brackets.
 */
function extractJsonArray(text: string, startIndex: number): string | null {
  if (text[startIndex] !== '[') return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;

    if (depth === 0) {
      return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

/**
 * Extract a JSON object starting at `startIndex` by counting braces.
 * Respects string boundaries and escape characters.
 */
function extractJsonObject(text: string, startIndex: number): string | null {
  if (text[startIndex] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;

    if (depth === 0) {
      return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

function isValidCaptionTrack(t: unknown): boolean {
  return typeof t === 'object' && t !== null && typeof (t as Record<string, unknown>)['baseUrl'] === 'string';
}

/**
 * Try to extract captionTracks by searching for the marker string.
 */
function tryExtractFromMarker(html: string, marker: string): CaptionTrack[] {
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const idx = html.indexOf(marker, searchFrom);
    if (idx === -1) break;

    let pos = idx + marker.length;
    while (pos < html.length && (html[pos] === ' ' || html[pos] === '\n' || html[pos] === '\r')) {
      pos += 1;
    }

    const arrayStr = extractJsonArray(html, pos);
    if (arrayStr !== null) {
      try {
        const tracks = JSON.parse(arrayStr) as CaptionTrack[];
        if (Array.isArray(tracks) && tracks.length > 0 && tracks.every(isValidCaptionTrack)) {
          return tracks;
        }
      } catch {
        // continue searching
      }
    }

    searchFrom = idx + marker.length;
  }

  return [];
}

function findPlayerResponseStart(html: string): number {
  const marker = 'ytInitialPlayerResponse';
  const idx = html.indexOf(marker);
  if (idx === -1) return -1;

  let pos = idx + marker.length;
  while (pos < html.length && (html[pos] === ' ' || html[pos] === '=')) {
    pos += 1;
  }
  while (pos < html.length && (html[pos] === ' ' || html[pos] === '\n' || html[pos] === '\r')) {
    pos += 1;
  }

  return pos < html.length && html[pos] === '{' ? pos : -1;
}

function extractTracksFromPlayerJson(jsonStr: string): CaptionTrack[] {
  try {
    const response = JSON.parse(jsonStr) as Record<string, unknown>;
    const captions = response['captions'] as Record<string, unknown> | undefined;
    const renderer = captions?.['playerCaptionsTracklistRenderer'] as Record<string, unknown> | undefined;
    const tracks = renderer?.['captionTracks'];

    if (!Array.isArray(tracks) || !tracks.every(isValidCaptionTrack)) return [];
    return tracks as CaptionTrack[];
  } catch {
    return [];
  }
}

/**
 * Extract the full ytInitialPlayerResponse and parse captionTracks from it.
 */
function tryExtractFromPlayerResponse(html: string): CaptionTrack[] {
  const pos = findPlayerResponseStart(html);
  if (pos === -1) return [];

  const jsonStr = extractJsonObject(html, pos);
  if (jsonStr === null) return [];

  return extractTracksFromPlayerJson(jsonStr);
}

/**
 * Extract caption tracks from YouTube page HTML.
 */
export function extractCaptionTracks(html: string): CaptionListResult {
  const fromPlayerResponse = tryExtractFromPlayerResponse(html);
  if (fromPlayerResponse.length > 0) {
    return { tracks: fromPlayerResponse };
  }

  const fromMarker = tryExtractFromMarker(html, '"captionTracks":');
  if (fromMarker.length > 0) {
    return { tracks: fromMarker };
  }

  return { tracks: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caption track selection and URL building
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the best caption track, preferring English and non-auto-generated.
 */
export function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;

  const manual = tracks.filter((t) => t.kind !== 'asr');
  const auto = tracks.filter((t) => t.kind === 'asr');

  const findEnglish = (list: CaptionTrack[]): CaptionTrack | undefined =>
    list.find((t) => t.languageCode.startsWith('en'));

  return findEnglish(manual) ?? manual[0] ?? findEnglish(auto) ?? auto[0] ?? null;
}

/**
 * Build the VTT-format caption URL from a track's baseUrl.
 */
export function buildCaptionUrl(track: CaptionTrack): string {
  const separator = track.baseUrl.includes('?') ? '&' : '?';
  return `${track.baseUrl}${separator}fmt=vtt`;
}

// ─────────────────────────────────────────────────────────────────────────────
// XML transcript parsing
// ─────────────────────────────────────────────────────────────────────────────

type YouTubeXmlSegment = {
  start: string;
  dur?: string | undefined;
  text: string;
};

/**
 * Parse YouTube's XML transcript format.
 * Format: <transcript><text start="0.0" dur="2.0">Hello</text>...</transcript>
 */
export function parseYouTubeXmlTranscript(xml: string): TranscriptResult {
  const segments: TranscriptSegment[] = [];
  const textRegex = /<text\s+start="([^"]+)"(?:\s+dur="([^"]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(xml)) !== null) {
    const entry: YouTubeXmlSegment = {
      start: match[1] ?? '0',
      dur: match[2],
      text: match[3] ?? '',
    };

    const startMs = Math.round(parseFloat(entry.start) * MILLISECONDS_PER_SECOND);
    const durMs =
      entry.dur !== undefined
        ? Math.round(parseFloat(entry.dur) * MILLISECONDS_PER_SECOND)
        : null;
    const endMs = durMs !== null ? startMs + durMs : null;

    const text = decodeXmlEntities(entry.text).trim();
    if (text.length > 0) {
      segments.push({ startMs, endMs, text });
    }
  }

  const plainText = segments.map((s) => s.text).join(' ');
  const lastSegment = segments[segments.length - 1];
  const durationMs = lastSegment?.endMs ?? lastSegment?.startMs ?? 0;

  return { plainText, segments, durationMs };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, ' ');
}
