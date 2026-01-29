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
const logDebug = (message: string, meta?: Record<string, unknown>) =>
  logWithPrefix(PANOPTO_PREFIX, 'debug', message, meta);
const logWarn = (message: string, meta?: Record<string, unknown>) =>
  logWithPrefix(PANOPTO_PREFIX, 'warn', message, meta);

function decodeEscapedUrl(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
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
  if (!decoded || decoded.startsWith('javascript:')) return null;
  const withProtocol = decoded.startsWith('//') ? `https:${decoded}` : decoded;
  try {
    return new URL(withProtocol, baseUrl).toString();
  } catch {
    return withProtocol;
  }
}

export function extractPanoptoInfoFromHtml(
  html: string,
  baseUrl: string,
): { info: PanoptoInfo; url: string } | null {
  const candidates = new Set<string>();
  const urlMatches = html.match(/(?:https?:)?\/\/[^\s"'<>]+/gi) || [];
  const escapedMatches = html.match(/https?:\\\/\\\/[^\s"'<>]+/gi) || [];
  const encodedMatches = html.match(/https?%3A%2F%2F[^\s"'<>]+/gi) || [];

  for (const match of [...urlMatches, ...escapedMatches, ...encodedMatches]) {
    if (!match.toLowerCase().includes('panopto')) continue;
    candidates.add(match);
  }

  for (const candidate of candidates) {
    const normalized = normalizePanoptoCandidateUrl(candidate, baseUrl);
    if (normalized) {
      const info = extractPanoptoInfo(normalized);
      if (info) return { info, url: normalized };
      try {
        const decoded = decodeURIComponent(normalized);
        if (decoded !== normalized) {
          const decodedInfo = extractPanoptoInfo(decoded);
          if (decodedInfo) return { info: decodedInfo, url: decoded };
        }
      } catch {
        // Ignore decode errors
      }
    }
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

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = decodeEscapedUrl(match[1]);
      logDebug('Caption URL found', { patternIndex: i + 1, url: url.substring(0, 100) });
      return url;
    }
  }

  logWarn('No caption URL found in embed HTML', { htmlLength: html.length });
  logDebug('Embed HTML sample', { sample: html.substring(0, 500).replace(/\s+/g, ' ') });

  return null;
}

/**
 * Extract media URL from Panopto embed page HTML for AI transcription.
 */
export function extractPanoptoMediaUrl(html: string): string | null {
  const isValidVideoUrl = (url: string): boolean => {
    if (!url || url.length < 10) return false;
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
  };

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

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = decodeEscapedUrl(match[1]);
      if (isValidVideoUrl(url)) {
        logDebug('Media URL found', { patternIndex: i + 1, url: url.substring(0, 100) });
        return url;
      } else {
        logDebug('Pattern matched but URL invalid', {
          patternIndex: i + 1,
          url: url.substring(0, 50),
        });
      }
    }
  }

  const urlKeys = Array.from(html.matchAll(/"(\w+Url|Url\w+)"\s*:\s*"([^"]+)"/g)).map(
    (match) => match[1],
  );

  if (urlKeys.length > 0) {
    logDebug('Found URL-like keys in embed HTML', { keys: urlKeys.slice(0, 10) });
  }

  const anyVideoUrl = html.match(/https?:\/\/[^"'\s]+(?:\.mp4|\.m3u8|\/stream\/|\/podcast\/)/i);
  if (anyVideoUrl && anyVideoUrl[0]) {
    logDebug('Found potential video URL in embed HTML', {
      url: anyVideoUrl[0].substring(0, 100),
    });
    return anyVideoUrl[0];
  }

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

    if (hasRedirectSupport(fetcher) && fetcher.fetchHtmlWithRedirectInfo) {
      const result = await fetcher.fetchHtmlWithRedirectInfo(url);
      html = result.html;
      finalUrl = result.finalUrl || url;
    } else {
      html = await fetcher.fetchWithCredentials(url);
    }

    const directInfo = extractPanoptoInfo(finalUrl);
    if (directInfo) {
      return { info: directInfo, authRequired: false, finalUrl };
    }

    const fromHtml = extractPanoptoInfoFromHtml(html, finalUrl || url);
    if (fromHtml) {
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
  if (video.panoptoTenant) {
    return buildPanoptoEmbedUrl(video.panoptoTenant, video.id);
  }

  return normalizePanoptoEmbedUrl(video.embedUrl) ?? video.embedUrl;
}

export function resolvePanoptoViewerUrl(video: DetectedVideo): string | null {
  if (video.panoptoTenant) {
    return buildPanoptoViewerUrl(video.panoptoTenant, video.id);
  }

  const info = extractPanoptoInfo(video.embedUrl);
  return info ? buildPanoptoViewerUrl(info.tenant, info.deliveryId) : null;
}

export function resolveCaptionUrl(captionUrl: string, baseUrl: string): string {
  const decoded = decodeEscapedUrl(captionUrl);
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}
