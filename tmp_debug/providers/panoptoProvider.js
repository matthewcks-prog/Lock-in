'use strict';
/**
 * Panopto Transcript Provider
 *
 * Handles detection and transcript extraction for Panopto videos.
 *
 * Detection strategies (in order of priority):
 * 1. Direct Panopto URLs - User is on panopto.com directly
 * 2. Embedded iframes - Panopto embedded in LMS page
 * 3. Anchor links - Links to Panopto (e.g., Moodle mod/url redirect pages)
 * 4. Meta refresh/redirects - Intermediate redirect pages
 *
 * This provider uses DOM-based detection (synchronous).
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.PanoptoProvider = void 0;
exports.extractDeliveryId = extractDeliveryId;
exports.extractTenantDomain = extractTenantDomain;
exports.isPanoptoUrl = isPanoptoUrl;
exports.isLmsRedirectPage = isLmsRedirectPage;
exports.isPanoptoDomain = isPanoptoDomain;
exports.extractPanoptoInfo = extractPanoptoInfo;
exports.buildPanoptoEmbedUrl = buildPanoptoEmbedUrl;
exports.buildPanoptoViewerUrl = buildPanoptoViewerUrl;
exports.normalizePanoptoEmbedUrl = normalizePanoptoEmbedUrl;
exports.detectPanoptoFromLinks = detectPanoptoFromLinks;
exports.detectPanoptoFromRedirect = detectPanoptoFromRedirect;
exports.extractCaptionVttUrl = extractCaptionVttUrl;
exports.extractPanoptoMediaUrl = extractPanoptoMediaUrl;
exports.createPanoptoProvider = createPanoptoProvider;
const webvttParser_1 = require('../webvttParser');
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
  /mod\/resource\/view\.php/i,
  /mod\/lti\/view\.php/i,
  /mod\/page\/view\.php/i,
];
// ─────────────────────────────────────────────────────────────────────────────
// Backwards Compatibility Wrappers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Extract delivery ID from a Panopto URL
 * @deprecated Use extractPanoptoInfo instead
 */
function extractDeliveryId(url) {
  var _a;
  const info = extractPanoptoInfo(url);
  return (_a = info === null || info === void 0 ? void 0 : info.deliveryId) !== null &&
    _a !== void 0
    ? _a
    : null;
}
/**
 * Extract tenant domain from a Panopto URL
 * Works with any panopto.com URL, even without a video ID
 * @deprecated Use extractPanoptoInfo instead for complete video info
 */
function extractTenantDomain(url) {
  // First try extractPanoptoInfo for complete URLs
  const info = extractPanoptoInfo(url);
  if (info === null || info === void 0 ? void 0 : info.tenant) return info.tenant;
  // Fallback: extract hostname from any panopto.com URL
  try {
    const urlObj = new URL(url);
    if (isPanoptoDomain(urlObj.hostname)) {
      return urlObj.hostname;
    }
  } catch (_a) {
    // Invalid URL
  }
  return null;
}
/**
 * Check if URL is a Panopto URL
 */
function isPanoptoUrl(url) {
  return PANOPTO_EMBED_REGEX.test(url) || PANOPTO_VIEWER_REGEX.test(url);
}
/**
 * Check if URL is a potential LMS redirect page
 */
function isLmsRedirectPage(url) {
  return LMS_REDIRECT_PATTERNS.some((pattern) => pattern.test(url));
}
/**
 * Check if a hostname is a Panopto domain
 */
function isPanoptoDomain(hostname) {
  return hostname.includes('panopto.com') || hostname.includes('panopto.');
}
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function resolveUrl(candidate, baseUrl) {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;
  if (trimmed.startsWith('javascript:')) return null;
  if (trimmed.startsWith('mailto:')) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch (_a) {
    return null;
  }
}
function getAnchorTitle(anchor) {
  var _a;
  return (
    ((_a = anchor.textContent) === null || _a === void 0 ? void 0 : _a.trim()) ||
    anchor.getAttribute('title') ||
    anchor.getAttribute('aria-label') ||
    anchor.getAttribute('data-title') ||
    ''
  );
}
/**
 * Extract Panopto info from any URL format
 * More permissive than the regex patterns - handles encoded URLs and various formats
 */
function extractPanoptoInfo(url) {
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
  } catch (_a) {
    // Not a valid URL, try decoding
  }
  // Try with URL decoding (handles double-encoded URLs)
  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url) {
      return extractPanoptoInfo(decoded);
    }
  } catch (_b) {
    // Ignore decode errors
  }
  return null;
}
/**
 * Build a canonical Panopto embed URL for a video.
 */
function buildPanoptoEmbedUrl(tenant, deliveryId) {
  return `https://${tenant}/Panopto/Pages/Embed.aspx?id=${encodeURIComponent(deliveryId)}`;
}
/**
 * Build a canonical Panopto viewer URL for a video.
 */
function buildPanoptoViewerUrl(tenant, deliveryId) {
  return `https://${tenant}/Panopto/Pages/Viewer.aspx?id=${encodeURIComponent(deliveryId)}`;
}
/**
 * Normalize a Panopto URL to its embed URL.
 */
function normalizePanoptoEmbedUrl(url) {
  const info = extractPanoptoInfo(url);
  return info ? buildPanoptoEmbedUrl(info.tenant, info.deliveryId) : null;
}
/**
 * Detect Panopto videos from anchor links on a page.
 * Catches cases where Panopto is linked but not embedded (e.g., Moodle mod/url).
 */
function detectPanoptoFromLinks(doc) {
  var _a;
  const videos = [];
  const seenIds = new Set();
  const baseUrl = doc.baseURI || (doc.location ? doc.location.href : '');
  let pageOrigin = null;
  try {
    pageOrigin = new URL(baseUrl).origin;
    if (pageOrigin === 'null') {
      pageOrigin = null;
    }
  } catch (_b) {
    pageOrigin = null;
  }
  const addVideo = (info, title) => {
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
  const addWrapperVideo = (wrapperUrl, title) => {
    const id = `wrapper_${hashString(wrapperUrl)}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    videos.push({
      id,
      provider: 'panopto',
      title: title || `Panopto link ${videos.length + 1}`,
      embedUrl: wrapperUrl,
    });
  };
  // Strategy 1: Check all anchor elements
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href') || anchor.href || '';
    if (!rawHref) continue;
    const resolvedHref = resolveUrl(rawHref, baseUrl);
    const href = resolvedHref || rawHref;
    let info = extractPanoptoInfo(href);
    // Also check data attributes (some LMS systems use these)
    if (!info) {
      const dataHref =
        anchor.getAttribute('data-href') ||
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
      continue;
    }
    const wrapperCandidate = (resolvedHref || rawHref).trim();
    const wrapperUrl = wrapperCandidate
      ? resolveUrl(wrapperCandidate, baseUrl) || wrapperCandidate
      : '';
    if (wrapperUrl && isLmsRedirectPage(wrapperUrl)) {
      let sameOrigin = true;
      if (pageOrigin) {
        try {
          sameOrigin = new URL(wrapperUrl).origin === pageOrigin;
        } catch (_c) {
          sameOrigin = true;
        }
      }
      if (sameOrigin) {
        const title = getAnchorTitle(anchor);
        addWrapperVideo(wrapperUrl, title);
      }
    }
  }
  // Strategy 2: Check onclick handlers (some themes use JavaScript)
  const elementsWithOnclick = Array.from(doc.querySelectorAll('[onclick*="panopto" i]'));
  for (const el of elementsWithOnclick) {
    const onclick = el.getAttribute('onclick') || '';
    const info = extractPanoptoInfo(onclick);
    if (info && !seenIds.has(info.deliveryId)) {
      const title = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
      addVideo(info, title);
    }
  }
  return videos;
}
/**
 * Detect Panopto from meta refresh or JavaScript redirects
 */
function detectPanoptoFromRedirect(doc) {
  var _a;
  const videos = [];
  const seenIds = new Set();
  const addVideo = (info, title) => {
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
      /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]*panopto[^'"]*)['"]/i,
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
  const bodyText = ((_a = doc.body) === null || _a === void 0 ? void 0 : _a.textContent) || '';
  // Match full Panopto URLs - the hostname must end with panopto.com
  const panoptoUrls = bodyText.match(/https?:\/\/[a-z0-9.-]+\.panopto\.com\/[^\s<>"']*/gi) || [];
  for (const url of panoptoUrls) {
    const info = extractPanoptoInfo(url);
    if (info && !seenIds.has(info.deliveryId)) {
      addVideo(info, '');
    }
  }
  return videos;
}
function decodeEscapedUrl(value) {
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
function extractCaptionVttUrl(html) {
  const patterns = [
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
    if (match === null || match === void 0 ? void 0 : match[1]) {
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
function extractPanoptoMediaUrl(html) {
  // Check if URL looks like a valid video URL
  const isValidVideoUrl = (url) => {
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
  const patterns = [
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
    if (match === null || match === void 0 ? void 0 : match[1]) {
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
function resolvePanoptoEmbedUrl(video) {
  var _a;
  if (video.panoptoTenant) {
    return buildPanoptoEmbedUrl(video.panoptoTenant, video.id);
  }
  return (_a = normalizePanoptoEmbedUrl(video.embedUrl)) !== null && _a !== void 0
    ? _a
    : video.embedUrl;
}
function resolvePanoptoViewerUrl(video) {
  if (video.panoptoTenant) {
    return buildPanoptoViewerUrl(video.panoptoTenant, video.id);
  }
  const info = extractPanoptoInfo(video.embedUrl);
  return info ? buildPanoptoViewerUrl(info.tenant, info.deliveryId) : null;
}
function resolveCaptionUrl(captionUrl, baseUrl) {
  const decoded = decodeEscapedUrl(captionUrl);
  try {
    return new URL(decoded, baseUrl).toString();
  } catch (_a) {
    return decoded;
  }
}
/**
 * Panopto transcript provider implementation
 */
class PanoptoProvider {
  constructor() {
    this.provider = 'panopto';
  }
  canHandle(url) {
    return isPanoptoUrl(url);
  }
  requiresAsyncDetection(_context) {
    // Panopto uses DOM-based detection only
    return false;
  }
  /**
   * Detect Panopto videos using multiple strategies:
   * 1. Current page URL (if user is on Panopto directly)
   * 2. Embedded iframes
   * 3. Anchor links on page
   * 4. Redirect mechanisms (meta refresh, JS redirects)
   */
  detectVideosSync(context) {
    const seenIds = new Set();
    const allVideos = [];
    const addVideos = (videos) => {
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
      addVideos([
        {
          id: pageInfo.deliveryId,
          provider: 'panopto',
          title: '', // Will be filled by caller
          embedUrl: buildPanoptoEmbedUrl(pageInfo.tenant, pageInfo.deliveryId),
          panoptoTenant: pageInfo.tenant,
        },
      ]);
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
    // Strategy 3 & 4: Check links and redirects (requires document)
    if (context.document) {
      // Check anchor links
      const linkVideos = detectPanoptoFromLinks(context.document);
      addVideos(linkVideos);
      // Check redirect mechanisms (especially for LMS redirect pages)
      if (isLmsRedirectPage(context.pageUrl)) {
        const redirectVideos = detectPanoptoFromRedirect(context.document);
        addVideos(redirectVideos);
      }
    }
    return allVideos;
  }
  async extractTranscript(video, fetcher) {
    try {
      const primaryEmbedUrl = resolvePanoptoEmbedUrl(video);
      const viewerUrl = resolvePanoptoViewerUrl(video);
      const candidateUrls = [primaryEmbedUrl, viewerUrl, video.embedUrl].filter(Boolean);
      const uniqueCandidateUrls = Array.from(new Set(candidateUrls));
      const extractFromUrl = async (url) => {
        const embedHtml = await fetcher.fetchWithCredentials(url);
        const captionUrl = extractCaptionVttUrl(embedHtml);
        if (!captionUrl) return null;
        const resolvedCaptionUrl = resolveCaptionUrl(captionUrl, url);
        const vttContent = await fetcher.fetchWithCredentials(resolvedCaptionUrl);
        const transcript = (0, webvttParser_1.parseWebVtt)(vttContent);
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
      let primaryFetched = false;
      let primaryError = null;
      try {
        const result = await extractFromUrl(primaryEmbedUrl);
        primaryFetched = true;
        if (result) return result;
      } catch (error) {
        primaryError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'AUTH_REQUIRED') {
          throw error;
        }
      }
      for (const url of uniqueCandidateUrls.slice(1)) {
        try {
          const result = await extractFromUrl(url);
          if (result) return result;
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
      if (primaryError && !primaryFetched) {
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
          error:
            "Network error. Please check your internet connection and ensure you're logged into Panopto.",
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
exports.PanoptoProvider = PanoptoProvider;
/**
 * Create a new Panopto provider instance
 */
function createPanoptoProvider() {
  return new PanoptoProvider();
}
