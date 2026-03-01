import type { DetectedVideo } from '../../types';
import type { AsyncFetcher, EnhancedAsyncFetcher } from '../../fetchers/types';
import { hasRedirectSupport } from '../../fetchers/types';
import {
  buildPanoptoEmbedUrl,
  buildPanoptoViewerUrl,
  extractPanoptoInfo,
  normalizePanoptoEmbedUrl,
  type PanoptoInfo,
} from './urlUtils';
import { logWithPrefix } from '../../utils/transcriptLogger';

const PANOPTO_PREFIX = '[Panopto]';
const logDebug = (message: string, meta?: Record<string, unknown>): void =>
  logWithPrefix(PANOPTO_PREFIX, 'debug', message, meta);
const logWarn = (message: string, meta?: Record<string, unknown>): void =>
  logWithPrefix(PANOPTO_PREFIX, 'warn', message, meta);

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const SCRIPT_PROTOCOL = 'java' + 'script:';
const MIN_VIDEO_URL_LENGTH = 10;
const URL_LOG_SAMPLE_LENGTH = 100;
const URL_LOG_SHORT_LENGTH = 50;
const HTML_LOG_SAMPLE_LENGTH = 500;
const URL_KEYS_SAMPLE_SIZE = 10;

function decodeEscapedUrl(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match: string, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\')
    .replace(/\\\"/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizePanoptoCandidateUrl(candidate: string, baseUrl: string): string | null {
  const decoded = decodeEscapedUrl(candidate);
  if (decoded.length === 0 || decoded.toLowerCase().startsWith(SCRIPT_PROTOCOL)) return null;
  const withProtocol = decoded.startsWith('//') ? `https:${decoded}` : decoded;
  try {
    return new URL(withProtocol, baseUrl).toString();
  } catch {
    return withProtocol;
  }
}

function tryDecodePanoptoInfo(url: string): { info: PanoptoInfo; url: string } | null {
  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url) {
      const decodedInfo = extractPanoptoInfo(decoded);
      if (decodedInfo !== null) return { info: decodedInfo, url: decoded };
    }
  } catch {
    // Ignore decode errors
  }
  return null;
}

export function extractPanoptoInfoFromHtml(
  html: string,
  baseUrl: string,
): { info: PanoptoInfo; url: string } | null {
  const candidates = new Set<string>([
    ...(html.match(/(?:https?:)?\/\/[^\s"'<>]+/gi) ?? []),
    ...(html.match(/https?:\\\/\\\/[^\s"'<>]+/gi) ?? []),
    ...(html.match(/https?%3A%2F%2F[^\s"'<>]+/gi) ?? []),
  ]);

  for (const candidate of candidates) {
    if (!candidate.toLowerCase().includes('panopto')) continue;
    const normalized = normalizePanoptoCandidateUrl(candidate, baseUrl);
    if (normalized === null) continue;
    const info = extractPanoptoInfo(normalized);
    if (info !== null) return { info, url: normalized };
    const decodedInfo = tryDecodePanoptoInfo(normalized);
    if (decodedInfo !== null) return decodedInfo;
  }

  return null;
}

/**
 * Extract caption VTT URL from Panopto embed page HTML.
 * Searches for multiple patterns in priority order.
 */
export function extractCaptionVttUrl(html: string): string | null {
  const patterns: RegExp[] = [
    /"CaptionUrl"\s*:\s*\[\s*"([^"]+)"/i,
    /"CaptionUrl"\s*:\s*"([^"]+)"/i,
    /"Captions"\s*:\s*\[\s*\{[^}]*"Url"\s*:\s*"([^"]+)"/i,
    /"Captions"\s*:\s*\[\s*\{[^}]*"VttUrl"\s*:\s*"([^"]+)"/i,
    /"Captions"\s*:\s*\[\s*\{[^}]*"CaptionUrl"\s*:\s*"([^"]+)"/i,
    /"TranscriptUrl"\s*:\s*"([^"]+)"/i,
    /((?:https?:)?\/\/[^"'\s]+GetCaptionVTT\.ashx\?[^"'\s]+)/i,
    /((?:\/)?Panopto\/Pages\/Transcription\/GetCaptionVTT\.ashx\?[^"'\s]+)/i,
  ];

  for (const [index, pattern] of patterns.entries()) {
    const match = html.match(pattern);
    const captured = match?.[1];
    if (captured !== undefined && captured.length > 0) {
      const url = decodeEscapedUrl(captured);
      logDebug('Caption URL found', {
        patternIndex: index + 1,
        url: url.substring(0, URL_LOG_SAMPLE_LENGTH),
      });
      return url;
    }
  }

  logWarn('No caption URL found in embed HTML', { htmlLength: html.length });
  logDebug('Embed HTML sample', {
    sample: html.substring(0, HTML_LOG_SAMPLE_LENGTH).replace(/\s+/g, ' '),
  });

  return null;
}

function isValidPanoptoVideoUrl(url: string): boolean {
  if (url.length < MIN_VIDEO_URL_LENGTH) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.mp4') ||
    lower.includes('.m3u8') ||
    lower.includes('stream') ||
    lower.includes('podcast') ||
    lower.includes('delivery') ||
    lower.includes('/video/') ||
    (lower.startsWith('http') && lower.includes('panopto'))
  );
}

function findMediaUrlFromPatterns(html: string, patterns: RegExp[]): string | null {
  for (const [index, pattern] of patterns.entries()) {
    const match = html.match(pattern);
    const captured = match?.[1];
    if (captured !== undefined && captured.length > 0) {
      const url = decodeEscapedUrl(captured);
      if (isValidPanoptoVideoUrl(url)) {
        logDebug('Media URL found', {
          patternIndex: index + 1,
          url: url.substring(0, URL_LOG_SAMPLE_LENGTH),
        });
        return url;
      }
      logDebug('Pattern matched but URL invalid', {
        patternIndex: index + 1,
        url: url.substring(0, URL_LOG_SHORT_LENGTH),
      });
    }
  }
  return null;
}

function logDetectedUrlKeys(html: string): void {
  const urlKeys = Array.from(html.matchAll(/"(\w+Url|Url\w+)"\s*:\s*"([^"]+)"/g)).map(
    (match) => match[1],
  );

  if (urlKeys.length > 0) {
    logDebug('Found URL-like keys in embed HTML', { keys: urlKeys.slice(0, URL_KEYS_SAMPLE_SIZE) });
  }
}

function findAnyVideoUrl(html: string): string | null {
  const anyVideoUrl = html.match(/https?:\/\/[^"'\s]+(?:\.mp4|\.m3u8|\/stream\/|\/podcast\/)/i);
  if (anyVideoUrl !== null && anyVideoUrl[0] !== undefined) {
    logDebug('Found potential video URL in embed HTML', {
      url: anyVideoUrl[0].substring(0, URL_LOG_SAMPLE_LENGTH),
    });
    return anyVideoUrl[0];
  }
  return null;
}

/**
 * Extract media URL from Panopto embed page HTML for AI transcription.
 */
export function extractPanoptoMediaUrl(html: string): string | null {
  const patterns: RegExp[] = [
    /"PodcastUrl"\s*:\s*"([^"]+)"/i,
    /"StreamUrl"\s*:\s*"([^"]+)"/i,
    /"IosStreamUrl"\s*:\s*"([^"]+)"/i,
    /"Streams"\s*:\s*\[\s*\{[^}]*"Url"\s*:\s*"([^"]+)"/i,
    /"DeliveryInfo"[^}]*"StreamUrl"\s*:\s*"([^"]+)"/i,
    /"(?:Url|url|URL)"\s*:\s*"(https?:\/\/[^"]*(?:mp4|stream|podcast|delivery|video)[^"]*)"/i,
    /"(?:Url|url|URL)"\s*:\s*"(https?:\/\/[^"]*panopto[^"]*\/(?:Podcast|Stream|Delivery)[^"]*)"/i,
  ];

  logDebug('Searching for media URL in embed HTML', { htmlLength: html.length });

  const fromPatterns = findMediaUrlFromPatterns(html, patterns);
  if (fromPatterns !== null) return fromPatterns;

  logDetectedUrlKeys(html);

  const anyVideoUrl = findAnyVideoUrl(html);
  if (anyVideoUrl !== null) return anyVideoUrl;

  logWarn('No media URL found for AI transcription');

  return null;
}

export async function resolvePanoptoInfoFromWrapperUrl(
  url: string,
  fetcher: AsyncFetcher | EnhancedAsyncFetcher,
): Promise<{ info: PanoptoInfo | null; authRequired: boolean; finalUrl?: string }> {
  try {
    let html = '';
    let finalUrl = url;

    if (hasRedirectSupport(fetcher)) {
      const result = await fetcher.fetchHtmlWithRedirectInfo(url);
      html = result.html;
      finalUrl = result.finalUrl.length > 0 ? result.finalUrl : url;
    } else {
      html = await fetcher.fetchWithCredentials(url);
    }

    const directInfo = extractPanoptoInfo(finalUrl);
    if (directInfo !== null) {
      return { info: directInfo, authRequired: false, finalUrl };
    }

    const resolvedBaseUrl = finalUrl.length > 0 ? finalUrl : url;
    const fromHtml = extractPanoptoInfoFromHtml(html, resolvedBaseUrl);
    if (fromHtml !== null) {
      return { info: fromHtml.info, authRequired: false, finalUrl: fromHtml.url };
    }

    return { info: null, authRequired: false, finalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'AUTH_REQUIRED') {
      return { info: null, authRequired: true };
    }
    return { info: null, authRequired: false };
  }
}

export function resolvePanoptoEmbedUrl(video: DetectedVideo): string {
  if (isNonEmptyString(video.panoptoTenant)) {
    return buildPanoptoEmbedUrl(video.panoptoTenant, video.id);
  }

  return normalizePanoptoEmbedUrl(video.embedUrl) ?? video.embedUrl;
}

export function resolvePanoptoViewerUrl(video: DetectedVideo): string | null {
  if (isNonEmptyString(video.panoptoTenant)) {
    return buildPanoptoViewerUrl(video.panoptoTenant, video.id);
  }

  const info = extractPanoptoInfo(video.embedUrl);
  return info !== null ? buildPanoptoViewerUrl(info.tenant, info.deliveryId) : null;
}

export function resolveCaptionUrl(captionUrl: string, baseUrl: string): string {
  const decoded = decodeEscapedUrl(captionUrl);
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}
