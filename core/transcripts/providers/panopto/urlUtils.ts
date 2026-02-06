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

/**
 * Panopto video info extracted from URL
 */
export interface PanoptoInfo {
  deliveryId: string;
  tenant: string;
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
  return LMS_REDIRECT_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a hostname is a Panopto domain
 */
export function isPanoptoDomain(hostname: string): boolean {
  return hostname.includes('panopto.com') || hostname.includes('panopto.');
}

/**
 * Extract Panopto info from any URL format
 * More permissive than the regex patterns - handles encoded URLs and various formats
 */
export function extractPanoptoInfo(url: string): PanoptoInfo | null {
  const embedMatch = url.match(PANOPTO_EMBED_REGEX);
  if (embedMatch) {
    const deliveryId = embedMatch[2];
    const tenant = embedMatch[1];
    if (deliveryId && tenant) {
      return { deliveryId, tenant };
    }
  }

  const viewerMatch = url.match(PANOPTO_VIEWER_REGEX);
  if (viewerMatch) {
    const deliveryId = viewerMatch[2];
    const tenant = viewerMatch[1];
    if (deliveryId && tenant) {
      return { deliveryId, tenant };
    }
  }

  try {
    const urlObj = new URL(url);
    if (isPanoptoDomain(urlObj.hostname)) {
      const id = urlObj.searchParams.get('id');
      if (id && id.length >= 8 && /^[a-f0-9-]+$/i.test(id)) {
        return { deliveryId: id, tenant: urlObj.hostname };
      }
    }
  } catch {
    // Not a valid URL, try decoding
  }

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
export function buildPanoptoEmbedUrl(tenant: string, deliveryId: string): string {
  return `https://${tenant}/Panopto/Pages/Embed.aspx?id=${encodeURIComponent(deliveryId)}`;
}

/**
 * Build a canonical Panopto viewer URL for a video.
 */
export function buildPanoptoViewerUrl(tenant: string, deliveryId: string): string {
  return `https://${tenant}/Panopto/Pages/Viewer.aspx?id=${encodeURIComponent(deliveryId)}`;
}

/**
 * Normalize a Panopto URL to its embed URL.
 */
export function normalizePanoptoEmbedUrl(url: string): string | null {
  const info = extractPanoptoInfo(url);
  return info ? buildPanoptoEmbedUrl(info.tenant, info.deliveryId) : null;
}
