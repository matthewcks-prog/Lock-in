/**
 * Panopto Transcript Provider
 * 
 * Handles detection and transcript extraction for Panopto video embeds.
 * Panopto embeds appear as iframes with src containing:
 *   https://<tenant>.panopto.com/Panopto/Pages/Embed.aspx?id=<deliveryId>
 * 
 * Caption VTT URL is extracted from the embed HTML bootstrap data.
 */

import type {
  TranscriptProvider,
  VideoProvider,
  DetectedVideo,
  VideoDetectionContext,
} from '@core/transcripts/types';

/**
 * Regex to match Panopto embed URLs
 * Captures: [1] = tenant subdomain, [2] = deliveryId
 */
const PANOPTO_EMBED_REGEX = /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Embed\.aspx\?.*\bid=([a-f0-9-]+)/i;

/**
 * Alternative pattern for direct Panopto viewer URLs
 */
const PANOPTO_VIEWER_REGEX = /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Viewer\.aspx\?.*\bid=([a-f0-9-]+)/i;

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
  const captionsMatch = html.match(/"Captions"\s*:\s*\[\s*\{\s*"Url"\s*:\s*"([^"]+)"/);
  if (captionsMatch) {
    return captionsMatch[1].replace(/\\/g, '');
  }
  
  // Pattern 3: Direct GetCaptionVTT.ashx URL reference
  const directVttMatch = html.match(/https?:\/\/[^"]+GetCaptionVTT\.ashx\?[^"]+/);
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
  const urlObj = new URL(url);
  const id = urlObj.searchParams.get('id');
  if (id && /^[a-f0-9-]+$/i.test(id)) {
    return id;
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
 * Panopto transcript provider implementation
 */
export class PanoptoTranscriptProvider implements TranscriptProvider {
  readonly provider: VideoProvider = 'panopto';
  
  canHandle(url: string): boolean {
    return PANOPTO_EMBED_REGEX.test(url) || PANOPTO_VIEWER_REGEX.test(url);
  }
  
  detectVideos(context: VideoDetectionContext): DetectedVideo[] {
    const videos: DetectedVideo[] = [];
    let videoIndex = 0;
    
    for (const iframe of context.iframes) {
      if (!iframe.src) continue;
      
      const deliveryId = extractDeliveryId(iframe.src);
      if (!deliveryId) continue;
      
      const tenantDomain = extractTenantDomain(iframe.src);
      if (!tenantDomain) continue;
      
      videoIndex++;
      
      // Determine title: use iframe title if available, otherwise fallback
      const title = iframe.title?.trim() || `Panopto video ${videoIndex}`;
      
      videos.push({
        id: deliveryId,
        provider: 'panopto',
        title,
        embedUrl: iframe.src,
        // Transcript URL will be extracted from embed HTML later
      });
    }
    
    return videos;
  }
  
  extractCaptionUrl(html: string, _video: DetectedVideo): string | null {
    return extractCaptionVttUrl(html);
  }
}

/**
 * Create a new Panopto provider instance
 */
export function createPanoptoProvider(): PanoptoTranscriptProvider {
  return new PanoptoTranscriptProvider();
}

