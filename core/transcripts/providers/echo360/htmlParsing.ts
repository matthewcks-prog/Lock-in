import type { Echo360Info } from '../../types/echo360Types';
import { extractEcho360Info } from './urlUtils';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const NESTED_MEDIA_KEYS = ['video', 'media', 'content', 'sections'] as const;

function readLowercaseId(value: unknown): string | null {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

function extractMediaIdFromMediaItem(item: unknown): string | null {
  if (item === null || item === undefined || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  return readLowercaseId(record['id']) ?? readLowercaseId(record['mediaId']);
}

function extractMediaIdFromMediaArray(medias: unknown): string | null {
  if (!Array.isArray(medias) || medias.length === 0) return null;
  return extractMediaIdFromMediaItem(medias[0]);
}

function extractFromNestedKeys(record: Record<string, unknown>): string | null {
  for (const key of NESTED_MEDIA_KEYS) {
    const nestedValue = record[key];
    if (nestedValue !== null && typeof nestedValue === 'object') {
      const nestedRecord = nestedValue as Record<string, unknown>;
      const nestedMediaId = extractMediaIdFromMediaArray(nestedRecord['medias']);
      if (nestedMediaId !== null) return nestedMediaId;
    }
  }
  return null;
}

/**
 * Extract mediaId from HTML content using multiple patterns
 */
export function extractMediaIdFromHtml(html: string): string | null {
  const jsonPatterns = [
    /"mediaId"\s*:\s*"([0-9a-f-]{36})"/i,
    /"media_id"\s*:\s*"([0-9a-f-]{36})"/i,
    /"mediaID"\s*:\s*"([0-9a-f-]{36})"/i,
    /"media"\s*:\s*{\s*"id"\s*:\s*"([0-9a-f-]{36})"/i,
    /mediaId\s*=\s*["']([0-9a-f-]{36})["']/i,
    /media_id\s*=\s*["']([0-9a-f-]{36})["']/i,
    /mediaID\s*=\s*["']([0-9a-f-]{36})["']/i,
  ];

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    const captured = match?.[1];
    if (isNonEmptyString(captured)) {
      return captured.toLowerCase();
    }
  }

  const urlPatterns = [
    /\/medias?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\/interactive-media\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /captions-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  ];

  for (const pattern of urlPatterns) {
    const match = html.match(pattern);
    const captured = match?.[1];
    if (isNonEmptyString(captured)) {
      return captured.toLowerCase();
    }
  }

  const dataMatch = html.match(/data-media-id\s*=\s*["']([0-9a-f-]{36})["']/i);
  const dataCaptured = dataMatch?.[1];
  if (isNonEmptyString(dataCaptured)) {
    return dataCaptured.toLowerCase();
  }

  return null;
}

/**
 * Extract mediaId from lesson API response
 */
export function extractMediaIdFromLessonInfo(lessonData: unknown): string | null {
  if (lessonData === null || lessonData === undefined || typeof lessonData !== 'object') {
    return null;
  }

  const data = lessonData as Record<string, unknown>;

  const fromMedias = extractMediaIdFromMediaArray(data['medias']);
  if (fromMedias !== null) return fromMedias;

  const nestedData = data['data'];
  if (nestedData !== null && typeof nestedData === 'object') {
    return extractMediaIdFromLessonInfo(nestedData);
  }

  const nestedLesson = data['lesson'];
  if (nestedLesson !== null && typeof nestedLesson === 'object') {
    return extractMediaIdFromLessonInfo(nestedLesson);
  }

  return extractFromNestedKeys(data);
}

/**
 * Parse Echo360 info from HTML page content
 */
export function parseEcho360InfoFromHtml(html: string, pageUrl: string): Echo360Info | null {
  const baseInfo = extractEcho360Info(pageUrl);
  const mediaId = extractMediaIdFromHtml(html);

  if (baseInfo !== null) {
    if (mediaId !== null) {
      return {
        ...baseInfo,
        mediaId,
      };
    }
    return baseInfo;
  }

  if (mediaId !== null) {
    try {
      const url = new URL(pageUrl);
      return { mediaId, baseUrl: url.origin };
    } catch {
      return null;
    }
  }

  return null;
}
