/**
 * Panopto Transcript Provider
 *
 * Handles detection and transcript extraction for Panopto video embeds.
 * Panopto embeds appear as iframes with src containing:
 *   https://<tenant>.panopto.com/Panopto/Pages/Embed.aspx?id=<deliveryId>
 *
 * This provider uses DOM-based detection (synchronous).
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  TranscriptExtractionResult,
} from '../types';
import type { TranscriptProviderV2, AsyncFetcher } from '../providerRegistry';
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

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract delivery ID from a Panopto URL
 */
export function extractDeliveryId(url: string): string | null {
  const embedMatch = url.match(PANOPTO_EMBED_REGEX);
  if (embedMatch) {
    return embedMatch[2];
  }

  const viewerMatch = url.match(PANOPTO_VIEWER_REGEX);
  if (viewerMatch) {
    return viewerMatch[2];
  }

  // Fallback: look for id= parameter
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    if (id && /^[a-f0-9-]+$/i.test(id)) {
      return id;
    }
  } catch {
    // Invalid URL
  }

  return null;
}

/**
 * Extract tenant domain from a Panopto URL
 */
export function extractTenantDomain(url: string): string | null {
  const embedMatch = url.match(PANOPTO_EMBED_REGEX);
  if (embedMatch) {
    return embedMatch[1];
  }

  const viewerMatch = url.match(PANOPTO_VIEWER_REGEX);
  if (viewerMatch) {
    return viewerMatch[1];
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('panopto.com')) {
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
 * Extract CaptionUrl from Panopto embed HTML
 *
 * Panopto embeds contain a JSON bootstrap object with caption URLs.
 * The pattern looks for: "CaptionUrl":["..."] or similar structures.
 *
 * @param html - The embed page HTML
 * @returns The first caption VTT URL or null
 */
export function extractCaptionVttUrl(html: string): string | null {
  // Pattern 1: Look for CaptionUrl in JSON structure
  // "CaptionUrl":["https://...GetCaptionVTT.ashx?id=..."]
  const captionUrlMatch = html.match(/"CaptionUrl"\s*:\s*\[\s*"([^"]+)"/);
  if (captionUrlMatch) {
    // Unescape JSON string escapes
    return captionUrlMatch[1].replace(/\\/g, '');
  }

  // Pattern 2: Look for Captions array with Url property
  // "Captions":[{"Url":"...","Language":"..."}]
  const captionsMatch = html.match(
    /"Captions"\s*:\s*\[\s*\{\s*"Url"\s*:\s*"([^"]+)"/
  );
  if (captionsMatch) {
    return captionsMatch[1].replace(/\\/g, '');
  }

  // Pattern 3: Direct GetCaptionVTT.ashx URL reference
  const directVttMatch = html.match(
    /https?:\/\/[^"]+GetCaptionVTT\.ashx\?[^"]+/
  );
  if (directVttMatch) {
    return directVttMatch[0].replace(/\\/g, '');
  }

  // Pattern 4: Look for TranscriptUrl
  const transcriptMatch = html.match(/"TranscriptUrl"\s*:\s*"([^"]+)"/);
  if (transcriptMatch) {
    return transcriptMatch[1].replace(/\\/g, '');
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Panopto transcript provider implementation
 */
export class PanoptoProvider implements TranscriptProviderV2 {
  readonly provider = 'panopto' as const;

  canHandle(url: string): boolean {
    return isPanoptoUrl(url) || this.hasPanoptoIframe(url);
  }

  /**
   * Check if URL might contain Panopto content (embedded)
   * This is a heuristic - we check for common LMS domains
   */
  private hasPanoptoIframe(url: string): boolean {
    // Panopto is usually embedded in LMS pages
    // We'll return false here and let DOM detection find iframes
    return false;
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    // Panopto uses DOM-based detection only
    return false;
  }

  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    const videos: DetectedVideo[] = [];
    const seenIds = new Set<string>();
    let videoIndex = 0;

    const addVideo = (
      deliveryId: string,
      tenant: string,
      title: string,
      embedUrl: string
    ): void => {
      if (seenIds.has(deliveryId)) return;
      seenIds.add(deliveryId);
      videoIndex++;
      videos.push({
        id: deliveryId,
        provider: 'panopto',
        title: title || `Panopto video ${videoIndex}`,
        embedUrl,
      });
    };

    // Check current page URL
    const pageDeliveryId = extractDeliveryId(context.pageUrl);
    const pageTenant = extractTenantDomain(context.pageUrl);
    if (pageDeliveryId && pageTenant) {
      addVideo(pageDeliveryId, pageTenant, '', context.pageUrl);
    }

    // Check all iframes
    for (const iframe of context.iframes) {
      if (!iframe.src) continue;
      const deliveryId = extractDeliveryId(iframe.src);
      const tenant = extractTenantDomain(iframe.src);
      if (deliveryId && tenant) {
        addVideo(deliveryId, tenant, iframe.title || '', iframe.src);
      }
    }

    return videos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher
  ): Promise<TranscriptExtractionResult> {
    try {
      // Step 1: Fetch the embed page HTML
      const embedHtml = await fetcher.fetchWithCredentials(video.embedUrl);

      // Step 2: Extract caption URL from the HTML
      const captionUrl = extractCaptionVttUrl(embedHtml);

      if (!captionUrl) {
        return {
          success: false,
          error: 'No captions available for this video',
          errorCode: 'NO_CAPTIONS',
          aiTranscriptionAvailable: true,
        };
      }

      // Step 3: Fetch the VTT content
      const vttContent = await fetcher.fetchWithCredentials(captionUrl);

      // Step 4: Parse the VTT
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

      if (
        message.includes('Failed to fetch') ||
        message.includes('NetworkError')
      ) {
        return {
          success: false,
          error: 'Network error. Please check your connection.',
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

