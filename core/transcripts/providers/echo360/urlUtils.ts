import type { Echo360Info } from '../../types/echo360Types';
import { extractSectionId } from '../../parsers/echo360Parser';

const ECHO360_DOMAIN_SUFFIXES = [
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
  'echo360qa.org',
  'echo360qa.dev',
];

/**
 * Check if URL is an Echo360 section/course page (not a single lesson view)
 */
export function isEcho360SectionPage(url: string): boolean {
  if (!isEcho360Url(url)) return false;

  const sectionId = extractSectionId(url);
  if (!sectionId) return false;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const isLessonPage = /\/lessons?\/[^/]+/.test(path);
    return !isLessonPage;
  } catch {
    return false;
  }
}

// ============================================================================//
// Domain & URL Helpers
// ============================================================================//

export function isEcho360Domain(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ECHO360_DOMAIN_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

export function isEcho360Url(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return isEcho360Domain(url.hostname);
  } catch {
    return rawUrl.toLowerCase().includes('echo360');
  }
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ============================================================================//
// ID Extraction
// ============================================================================//

/**
 * Extract lessonId from URL pathname
 * Lesson IDs can be complex: G_{uuid}_{uuid}_{timestamp}_{timestamp}
 */
function extractLessonIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/lessons?\/([^\/]+)/i);
  if (match?.[1]) {
    return safeDecodeUri(match[1]);
  }
  return null;
}

/**
 * Extract mediaId from URL pathname (standard UUID format)
 */
function extractMediaIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /\/medias?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  const mediaId = match?.[1];
  return mediaId ? mediaId.toLowerCase() : null;
}

/**
 * Extract Echo360 info from a URL
 */
export function extractEcho360Info(rawUrl: string): Echo360Info | null {
  try {
    // First check if this URL contains an embedded Echo360 URL (e.g., LTI launch URLs)
    const decoded = safeDecodeUri(rawUrl);

    // Look for embedded Echo360 URL in query params
    try {
      const outerUrl = new URL(decoded);
      for (const [, value] of outerUrl.searchParams.entries()) {
        const decodedValue = safeDecodeUri(value);
        if (decodedValue.includes('echo360')) {
          const innerInfo = extractEcho360Info(decodedValue);
          if (innerInfo?.lessonId || innerInfo?.mediaId) {
            return innerInfo;
          }
        }
      }
    } catch {
      // Not a valid URL with params, continue
    }

    const url = new URL(decoded);

    if (!isEcho360Domain(url.hostname)) {
      return null;
    }

    const lessonId = extractLessonIdFromPath(url.pathname);
    const mediaId = extractMediaIdFromPath(url.pathname);

    const paramLessonId = url.searchParams.get('lessonId') || url.searchParams.get('lesson_id');
    const paramMediaId = url.searchParams.get('mediaId') || url.searchParams.get('media_id');

    const info: Echo360Info = {
      baseUrl: url.origin,
    };
    const resolvedLessonId = lessonId || paramLessonId || null;
    const resolvedMediaId = mediaId || (paramMediaId ? paramMediaId.toLowerCase() : null);
    if (resolvedLessonId) {
      info.lessonId = resolvedLessonId;
    }
    if (resolvedMediaId) {
      info.mediaId = resolvedMediaId;
    }
    return info;
  } catch {
    return null;
  }
}
