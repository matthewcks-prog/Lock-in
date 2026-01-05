/**
 * Panopto Transcript Provider
 *
 * Handles detection and transcript extraction for Panopto videos.
 * 
 * Detection strategies (in order of priority):
 * 1. Direct Panopto URLs - User is on panopto.com directly
 * 2. Embedded iframes - Panopto embedded in LMS page
 *
 * This provider uses DOM-based detection (synchronous).
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  TranscriptExtractionResult,
} from '../types';
import type { TranscriptProviderV2 } from '../providerRegistry';
import type { EnhancedAsyncFetcher } from '../fetchers/types';
import { hasRedirectSupport, hasHtmlParsingSupport } from '../fetchers/types';
import { parseWebVtt } from '../webvttParser';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex to match Panopto embed URLs
 * Captures: [1] = tenant subdomain, [2] = deliveryId
 */
const PANOPTO_EMBED_REGEX =
  /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Embed\.aspx\?.*\bid=([a-f0-9-]+)/i;

/**
 * Alternative pattern for direct Panopto viewer URLs
 */
const PANOPTO_VIEWER_REGEX =
  /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Viewer\.aspx\?.*\bid=([a-f0-9-]+)/i;

/**
 * Pattern to detect Moodle/LMS redirect pages that might link to Panopto
 */
const LMS_REDIRECT_PATTERNS = [
  /mod\/url\/view\.php/i,
  /mod\/lti\/view\.php/i,
  /mod\/page\/view\.php/i,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Backwards Compatibility Wrappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract delivery ID from a Panopto URL
 * @deprecated Use extractPanoptoInfo instead
 */
export function extractDeliveryId(url: string): string | null {
  const info = extractPanoptoInfo(url);
  return info?.deliveryId ?? null;
}

/**
 * Extract tenant domain from a Panopto URL
 * Works with any panopto.com URL, even without a video ID
 * @deprecated Use extractPanoptoInfo instead for complete video info
 */
export function extractTenantDomain(url: string): string | null {
  // First try extractPanoptoInfo for complete URLs
  const info = extractPanoptoInfo(url);
  if (info?.tenant) return info.tenant;
  
  // Fallback: extract hostname from any panopto.com URL
  try {
    const urlObj = new URL(url);
    if (isPanoptoDomain(urlObj.hostname)) {
      return urlObj.hostname;
    }
  } catch {
    // Invalid URL
  }
  
  return null;
}

/**
 * Check if URL is a Panopto URL
 */
export function isPanoptoUrl(url: string): boolean {
  return PANOPTO_EMBED_REGEX.test(url) || PANOPTO_VIEWER_REGEX.test(url);
}

/**
 * Check if URL is a potential LMS redirect page
 */
export function isLmsRedirectPage(url: string): boolean {
  return LMS_REDIRECT_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if a hostname is a Panopto domain
 */
export function isPanoptoDomain(hostname: string): boolean {
  return hostname.includes('panopto.com') || hostname.includes('panopto.');
}

function resolveUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;
  if (trimmed.startsWith('javascript:')) return null;
  if (trimmed.startsWith('mailto:')) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function getAnchorTitle(anchor: HTMLAnchorElement): string {
  return (
    anchor.textContent?.trim() ||
    anchor.getAttribute('title') ||
    anchor.getAttribute('aria-label') ||
    anchor.getAttribute('data-title') ||
    ''
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Link Detection Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Panopto video info extracted from URL
 */
export interface PanoptoInfo {
  deliveryId: string;
  tenant: string;
}

/**
 * Extract Panopto info from any URL format
 * More permissive than the regex patterns - handles encoded URLs and various formats
 */
export function extractPanoptoInfo(url: string): PanoptoInfo | null {
  // Try standard patterns first
  const embedMatch = url.match(PANOPTO_EMBED_REGEX);
  if (embedMatch) {
    return { deliveryId: embedMatch[2], tenant: embedMatch[1] };
  }

  const viewerMatch = url.match(PANOPTO_VIEWER_REGEX);
  if (viewerMatch) {
    return { deliveryId: viewerMatch[2], tenant: viewerMatch[1] };
  }

  // Try parsing as URL and extracting 'id' param
  try {
    const urlObj = new URL(url);
    if (isPanoptoDomain(urlObj.hostname)) {
      const id = urlObj.searchParams.get('id');
      // ID should be a UUID-like format (at least 8 characters with hex and dashes)
      if (id && id.length >= 8 && /^[a-f0-9-]+$/i.test(id)) {
        return { deliveryId: id, tenant: urlObj.hostname };
      }
    }
  } catch {
    // Not a valid URL, try decoding
  }

  // Try with URL decoding (handles double-encoded URLs)
  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url) {
      return extractPanoptoInfo(decoded);
    }
  } catch {
    // Ignore decode errors
  }

  return null;
}

/**
 * Build a canonical Panopto embed URL for a video.
 */
export function buildPanoptoEmbedUrl(
  tenant: string,
  deliveryId: string
): string {
  return `https://${tenant}/Panopto/Pages/Embed.aspx?id=${encodeURIComponent(
    deliveryId
  )}`;
}

/**
 * Build a canonical Panopto viewer URL for a video.
 */
export function buildPanoptoViewerUrl(
  tenant: string,
  deliveryId: string
): string {
  return `https://${tenant}/Panopto/Pages/Viewer.aspx?id=${encodeURIComponent(
    deliveryId
  )}`;
}

/**
 * Normalize a Panopto URL to its embed URL.
 */
export function normalizePanoptoEmbedUrl(url: string): string | null {
  const info = extractPanoptoInfo(url);
  return info ? buildPanoptoEmbedUrl(info.tenant, info.deliveryId) : null;
}


/**
 * Detect Panopto videos from anchor links on a page.
 * Catches cases where Panopto is linked but not embedded.
 */
export function detectPanoptoFromLinks(doc: Document): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();
  const baseUrl =
    doc.baseURI || (doc.location ? doc.location.href : '');

  const addVideo = (info: PanoptoInfo, title: string): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);
    
    const embedUrl = buildPanoptoEmbedUrl(info.tenant, info.deliveryId);
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: title || `Panopto video ${videos.length + 1}`,
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };

  // Strategy 1: Check all anchor elements
  const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href') || anchor.href || '';
    if (!rawHref) continue;
    const resolvedHref = resolveUrl(rawHref, baseUrl);
    const href = resolvedHref || rawHref;

    let info = extractPanoptoInfo(href);
    
    // Also check data attributes (some LMS systems use these)
    if (!info) {
      const dataHref = anchor.getAttribute('data-href') || 
                       anchor.getAttribute('data-url') ||
                       anchor.getAttribute('data-src');
      if (dataHref) {
        const resolvedDataHref = resolveUrl(dataHref, baseUrl);
        info = extractPanoptoInfo(resolvedDataHref || dataHref);
      }
    }

    if (info) {
      const title = getAnchorTitle(anchor);
      addVideo(info, title);
    }
  }

  // Strategy 2: Check onclick handlers (some themes use JavaScript)
  const elementsWithOnclick = Array.from(
    doc.querySelectorAll('[onclick*="panopto" i]')
  ) as HTMLElement[];
  
  for (const el of elementsWithOnclick) {
    const onclick = el.getAttribute('onclick') || '';
    const info = extractPanoptoInfo(onclick);
    if (info && !seenIds.has(info.deliveryId)) {
      const title = el.textContent?.trim() || '';
      addVideo(info, title);
    }
  }

  return videos;
}

/**
 * Detect Panopto from meta refresh or JavaScript redirects
 */
export function detectPanoptoFromRedirect(doc: Document): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (info: PanoptoInfo, title: string): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);
    
    const embedUrl = buildPanoptoEmbedUrl(info.tenant, info.deliveryId);
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: title || doc.title || 'Panopto video',
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };

  // Check meta refresh tags
  const metaRefresh = doc.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    const content = metaRefresh.getAttribute('content') || '';
    const urlMatch = content.match(/url=(.+)/i);
    if (urlMatch) {
      const info = extractPanoptoInfo(urlMatch[1]);
      if (info) {
        addVideo(info, '');
      }
    }
  }

  // Check for window.location assignments in scripts
  const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
  for (const script of scripts) {
    const content = script.textContent || '';
    // Look for panopto URLs in location assignments
    const locationMatch = content.match(
      /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]*panopto[^'"]*)['"]/i
    );
    if (locationMatch) {
      const info = extractPanoptoInfo(locationMatch[1]);
      if (info && !seenIds.has(info.deliveryId)) {
        addVideo(info, '');
      }
    }
  }

  // Check for Panopto URLs in visible page content (last resort)
  // This catches "You will be redirected to..." type pages
  const bodyText = doc.body?.textContent || '';
  // Match full Panopto URLs - the hostname must end with panopto.com
  const panoptoUrls = bodyText.match(
    /https?:\/\/[a-z0-9.-]+\.panopto\.com\/[^\s<>"']*/gi
  ) || [];
  
  for (const url of panoptoUrls) {
    const info = extractPanoptoInfo(url);
    if (info && !seenIds.has(info.deliveryId)) {
      addVideo(info, '');
    }
  }

  return videos;
}

function decodeEscapedUrl(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
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

/**
 * Extract CaptionUrl from Panopto embed HTML
 *
 * Panopto embeds contain a JSON bootstrap object with caption URLs.
 * The pattern looks for: "CaptionUrl":["..."] or similar structures.
 *
 * @param html - The embed page HTML
 * @returns The first caption VTT URL or null
 */
/**
 * Extract caption VTT URL from Panopto embed page HTML.
 * Searches for multiple patterns in priority order.
 *
 * @param html - The embed page HTML
 * @returns The first caption VTT URL or null
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
      console.log(`[Panopto] Caption URL found with pattern ${i + 1}:`, url.substring(0, 100));
      return url;
    }
  }

  console.warn('[Panopto] No caption URL found in embed HTML. HTML length:', html.length);
  // Log a sample of the HTML for debugging (first 500 chars)
  console.log('[Panopto] HTML sample:', html.substring(0, 500).replace(/\s+/g, ' '));
  
  return null;
}

/**
 * Extract media URL from Panopto embed page HTML for AI transcription.
 * Panopto provides multiple delivery URLs:
 * - StreamUrl: Primary MP4 video stream
 * - PodcastUrl: Alternative download URL (often better for AI transcription)
 * - DeliveryInfo.Streams: Array of stream URLs with different qualities
 *
 * @param html - The embed page HTML
 * @returns The first available media URL or null
 */
export function extractPanoptoMediaUrl(html: string): string | null {
  // Check if URL looks like a valid video URL
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

  // Priority order: Most specific to most general
  const patterns: RegExp[] = [
    // 1. PodcastUrl (direct download, best for AI)
    /"PodcastUrl"\s*:\s*"([^"]+)"/i,
    
    // 2. StreamUrl (primary stream)
    /"StreamUrl"\s*:\s*"([^"]+)"/i,
    
    // 3. IosStreamUrl (iOS-compatible, usually MP4)
    /"IosStreamUrl"\s*:\s*"([^"]+)"/i,
    
    // 4. Streams array with Url
    /"Streams"\s*:\s*\[\s*\{[^}]*"Url"\s*:\s*"([^"]+)"/i,
    
    // 5. DeliveryInfo with StreamUrl
    /"DeliveryInfo"[^}]*"StreamUrl"\s*:\s*"([^"]+)"/i,
    
    // 6. Any URL field containing video-like paths
    /"(?:Url|url|URL)"\s*:\s*"(https?:\/\/[^"]*(?:mp4|stream|podcast|delivery|video)[^"]*)"/i,
    
    // 7. Generic panopto video URLs
    /"(?:Url|url|URL)"\s*:\s*"(https?:\/\/[^"]*panopto[^"]*\/(?:Podcast|Stream|Delivery)[^"]*)"/i,
  ];

  console.log('[Panopto] Searching for media URL in HTML (length:', html.length, ')');
  
  // Try each pattern
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = decodeEscapedUrl(match[1]);
      if (isValidVideoUrl(url)) {
        console.log(`[Panopto] Media URL found with pattern ${i + 1}:`, url.substring(0, 100));
        return url;
      } else {
        console.log(`[Panopto] Pattern ${i + 1} matched but URL invalid:`, url.substring(0, 50));
      }
    }
  }

  // Debug: Log what keys are actually in the HTML
  const urlKeys = html.match(/"\\w*[Uu]rl\\w*"\s*:/g);
  if (urlKeys) {
    console.log('[Panopto] Found URL-like keys in HTML:', urlKeys.slice(0, 10).join(', '));
  }
  
  // Debug: Check if there are any video URLs at all
  const anyVideoUrl = html.match(/https?:\/\/[^"\s]*(?:mp4|m3u8|stream|podcast)/i);
  if (anyVideoUrl) {
    console.log('[Panopto] Found potential video URL in HTML:', anyVideoUrl[0].substring(0, 100));
  }

  console.warn('[Panopto] No media URL found for AI transcription');
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────────────────────

function resolvePanoptoEmbedUrl(video: DetectedVideo): string {
  if (video.panoptoTenant) {
    return buildPanoptoEmbedUrl(video.panoptoTenant, video.id);
  }

  return normalizePanoptoEmbedUrl(video.embedUrl) ?? video.embedUrl;
}

function resolvePanoptoViewerUrl(video: DetectedVideo): string | null {
  if (video.panoptoTenant) {
    return buildPanoptoViewerUrl(video.panoptoTenant, video.id);
  }

  const info = extractPanoptoInfo(video.embedUrl);
  return info ? buildPanoptoViewerUrl(info.tenant, info.deliveryId) : null;
}

function resolveCaptionUrl(captionUrl: string, baseUrl: string): string {
  const decoded = decodeEscapedUrl(captionUrl);
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}

/**
 * Panopto transcript provider implementation
 */
export class PanoptoProvider implements TranscriptProviderV2 {
  readonly provider = 'panopto' as const;

  canHandle(url: string): boolean {
    return isPanoptoUrl(url);
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    // Panopto uses DOM-based detection only
    return false;
  }

  /**
   * Detect Panopto videos using multiple strategies:
   * 1. Current page URL (if user is on Panopto directly)
   * 2. Embedded iframes
   */
  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    const seenIds = new Set<string>();
    const allVideos: DetectedVideo[] = [];

    const addVideos = (videos: DetectedVideo[]): void => {
      for (const video of videos) {
        if (!seenIds.has(video.id)) {
          seenIds.add(video.id);
          allVideos.push(video);
        }
      }
    };

    // Strategy 1: Check current page URL
    const pageInfo = extractPanoptoInfo(context.pageUrl);
    if (pageInfo) {
      addVideos([{
        id: pageInfo.deliveryId,
        provider: 'panopto',
        title: '', // Will be filled by caller
        embedUrl: buildPanoptoEmbedUrl(pageInfo.tenant, pageInfo.deliveryId),
        panoptoTenant: pageInfo.tenant,
      }]);
    }

    // Strategy 2: Check iframes
    for (const iframe of context.iframes) {
      if (!iframe.src) continue;
      const info = extractPanoptoInfo(iframe.src);
      if (info && !seenIds.has(info.deliveryId)) {
        seenIds.add(info.deliveryId);
        allVideos.push({
          id: info.deliveryId,
          provider: 'panopto',
          title: iframe.title || `Panopto video ${allVideos.length + 1}`,
          embedUrl: buildPanoptoEmbedUrl(info.tenant, info.deliveryId),
          panoptoTenant: info.tenant,
        });
      }
    }

    return allVideos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: EnhancedAsyncFetcher
  ): Promise<TranscriptExtractionResult> {
    try {
      // Validate video embedUrl
      if (!video.embedUrl) {
        return {
          success: false,
          error: 'No video URL provided',
          errorCode: 'INVALID_VIDEO',
          aiTranscriptionAvailable: true,
        };
      }

      // Build initial candidate URLs (same as background.js)
      const candidateUrls: string[] = [];
      if (video.panoptoTenant && video.id) {
        candidateUrls.push(
          buildPanoptoEmbedUrl(video.panoptoTenant, video.id),
          buildPanoptoViewerUrl(video.panoptoTenant, video.id)
        );
      }

      // Use resolve functions to handle edge cases
      const primaryEmbedUrl = resolvePanoptoEmbedUrl(video);
      const viewerUrl = resolvePanoptoViewerUrl(video);
      
      if (primaryEmbedUrl) {
        candidateUrls.push(primaryEmbedUrl);
      }
      if (viewerUrl) {
        candidateUrls.push(viewerUrl);
      }

      candidateUrls.push(video.embedUrl);
      const pendingUrls = Array.from(
        new Set(candidateUrls.filter(Boolean))
      );
      const visitedUrls = new Set<string>();
      let anyFetched = false;
      let primaryError: unknown = null;

      // Dynamic discovery helper (same as background.js)
      const enqueueCandidate = (candidate: string | null): void => {
        if (!candidate) return;
        if (visitedUrls.has(candidate)) return;
        if (pendingUrls.includes(candidate)) return;
        pendingUrls.push(candidate);
      };

      // Extract from URL with dynamic discovery support
      const extractFromUrl = async (
        url: string
      ): Promise<TranscriptExtractionResult | null> => {
        // Use redirect-aware fetch if available (preserves redirect tracking)
        let html: string;
        let finalUrl: string;
        
        if (hasRedirectSupport(fetcher) && fetcher.fetchHtmlWithRedirectInfo) {
          const result = await fetcher.fetchHtmlWithRedirectInfo(url);
          html = result.html;
          finalUrl = result.finalUrl;
        } else {
          // Fallback to basic fetch
          html = await fetcher.fetchWithCredentials(url);
          finalUrl = url;
        }
        
        anyFetched = true;

        const captionUrl = extractCaptionVttUrl(html);
        
        // Dynamic discovery: find more URLs from HTML if captions not found
        if (!captionUrl) {
          if (hasHtmlParsingSupport(fetcher) && fetcher.extractPanoptoInfoFromHtml) {
            const resolvedInfo = extractPanoptoInfo(finalUrl);
            const fromHtml = fetcher.extractPanoptoInfoFromHtml(html, finalUrl || url);
            const info = resolvedInfo || fromHtml?.info;

            if (fromHtml?.url) {
              enqueueCandidate(fromHtml.url);
            }
            if (info) {
              enqueueCandidate(
                buildPanoptoEmbedUrl(info.tenant, info.deliveryId)
              );
              enqueueCandidate(
                buildPanoptoViewerUrl(info.tenant, info.deliveryId)
              );
            }
          }
          return null; // Try next URL
        }

        const resolvedCaptionUrl = resolveCaptionUrl(captionUrl, finalUrl);
        const vttContent = await fetcher.fetchWithCredentials(resolvedCaptionUrl);
        const transcript = parseWebVtt(vttContent);

        if (transcript.segments.length === 0) {
          return {
            success: false,
            error: 'Caption file is empty or could not be parsed',
            errorCode: 'PARSE_ERROR',
            aiTranscriptionAvailable: true,
          };
        }

        return {
          success: true,
          transcript,
        };
      };

      // Try URLs with dynamic discovery (same while loop as background.js)
      while (pendingUrls.length > 0) {
        const url = pendingUrls.shift();
        if (!url || visitedUrls.has(url)) continue;
        visitedUrls.add(url);

        try {
          const result = await extractFromUrl(url);
          if (result) {
            return result;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message === 'AUTH_REQUIRED') {
            throw error;
          }
          if (!primaryError) {
            primaryError = error;
          }
        }
      }

      if (!anyFetched && primaryError) {
        throw primaryError;
      }

      return {
        success: false,
        error: 'No captions available for this video',
        errorCode: 'NO_CAPTIONS',
        aiTranscriptionAvailable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === 'AUTH_REQUIRED') {
        return {
          success: false,
          error: 'Authentication required. Please log in to Panopto.',
          errorCode: 'AUTH_REQUIRED',
          aiTranscriptionAvailable: true,
        };
      }

      // Timeout errors
      if (message.includes('timeout') || message.includes('AbortError')) {
        return {
          success: false,
          error: 'Request timeout. The server took too long to respond.',
          errorCode: 'TIMEOUT',
          aiTranscriptionAvailable: true,
        };
      }

      // Network/CORS errors
      if (
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('CORS') ||
        message.includes('Network request failed')
      ) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and ensure you\'re logged into Panopto.',
          errorCode: 'NETWORK_ERROR',
          aiTranscriptionAvailable: true,
        };
      }

      return {
        success: false,
        error: `Failed to extract transcript: ${message}`,
        errorCode: 'PARSE_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
  }
}

/**
 * Create a new Panopto provider instance
 */
export function createPanoptoProvider(): PanoptoProvider {
  return new PanoptoProvider();
}

