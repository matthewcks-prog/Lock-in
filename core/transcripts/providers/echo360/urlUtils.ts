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

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const firstNonEmptyString = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return null;
};

/**
 * Check if URL is an Echo360 section/course page (not a single lesson view)
 */
export function isEcho360SectionPage(url: string): boolean {
  if (!isEcho360Url(url)) return false;

  const sectionId = extractSectionId(url);
  if (sectionId === null) return false;

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

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasIdentifiers(info: Echo360Info | null): info is Echo360Info {
  return info !== null && (isNonEmptyString(info.lessonId) || isNonEmptyString(info.mediaId));
}

function getFirstParam(url: URL, names: string[]): string | null {
  const values = names.map((name) => url.searchParams.get(name));
  return firstNonEmptyString(values);
}

function tryExtractEmbeddedInfo(rawUrl: string): Echo360Info | null {
  const outerUrl = tryParseUrl(rawUrl);
  if (outerUrl === null) return null;

  for (const [, value] of outerUrl.searchParams.entries()) {
    const decodedValue = safeDecodeUri(value);
    if (!decodedValue.includes('echo360')) continue;
    const innerInfo = extractEcho360Info(decodedValue);
    if (hasIdentifiers(innerInfo)) {
      return innerInfo;
    }
  }

  return null;
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
  const lessonId = match?.[1];
  if (lessonId !== undefined && lessonId.length > 0) {
    return safeDecodeUri(lessonId);
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
  return mediaId !== undefined && mediaId.length > 0 ? mediaId.toLowerCase() : null;
}

/**
 * Extract Echo360 info from a URL
 */
export function extractEcho360Info(rawUrl: string): Echo360Info | null {
  const decoded = safeDecodeUri(rawUrl);
  const embedded = tryExtractEmbeddedInfo(decoded);
  if (embedded !== null) return embedded;

  const url = tryParseUrl(decoded);
  if (url === null) return null;
  if (!isEcho360Domain(url.hostname)) return null;

  const lessonId = extractLessonIdFromPath(url.pathname);
  const mediaId = extractMediaIdFromPath(url.pathname);

  const paramLessonId = getFirstParam(url, ['lessonId', 'lesson_id']);
  const paramMediaId = getFirstParam(url, ['mediaId', 'media_id']);

  const info: Echo360Info = {
    baseUrl: url.origin,
  };
  const normalizedParamMediaId = paramMediaId !== null ? paramMediaId.toLowerCase() : null;
  const resolvedLessonId = firstNonEmptyString([lessonId, paramLessonId]);
  const resolvedMediaId = firstNonEmptyString([mediaId, normalizedParamMediaId]);
  if (resolvedLessonId !== null) {
    info.lessonId = resolvedLessonId;
  }
  if (resolvedMediaId !== null) {
    info.mediaId = resolvedMediaId;
  }
  return info;
}
