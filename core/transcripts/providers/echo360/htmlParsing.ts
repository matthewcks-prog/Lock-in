import type { Echo360Info } from '../../types/echo360Types';
import { extractEcho360Info } from './urlUtils';

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
    if (match?.[1]) {
      return match[1].toLowerCase();
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
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  const dataMatch = html.match(/data-media-id\s*=\s*["']([0-9a-f-]{36})["']/i);
  if (dataMatch?.[1]) {
    return dataMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Extract mediaId from lesson API response
 */
export function extractMediaIdFromLessonInfo(lessonData: unknown): string | null {
  if (!lessonData || typeof lessonData !== 'object') return null;

  const data = lessonData as Record<string, unknown>;

  if (Array.isArray(data.medias) && data.medias.length > 0) {
    const firstMedia = data.medias[0] as Record<string, unknown>;
    if (typeof firstMedia?.id === 'string') {
      return firstMedia.id.toLowerCase();
    }
    if (typeof firstMedia?.mediaId === 'string') {
      return firstMedia.mediaId.toLowerCase();
    }
  }

  if (data.data && typeof data.data === 'object') {
    return extractMediaIdFromLessonInfo(data.data);
  }

  if (data.lesson && typeof data.lesson === 'object') {
    return extractMediaIdFromLessonInfo(data.lesson);
  }

  const nestedKeys = ['video', 'media', 'content', 'sections'];
  for (const key of nestedKeys) {
    if (data[key] && typeof data[key] === 'object') {
      const nested = data[key] as Record<string, unknown>;
      if (Array.isArray(nested.medias) && nested.medias.length > 0) {
        const firstMedia = nested.medias[0] as Record<string, unknown>;
        if (typeof firstMedia?.id === 'string') {
          return firstMedia.id.toLowerCase();
        }
      }
    }
  }

  return null;
}

/**
 * Parse Echo360 info from HTML page content
 */
export function parseEcho360InfoFromHtml(html: string, pageUrl: string): Echo360Info | null {
  const baseInfo = extractEcho360Info(pageUrl);
  const mediaId = extractMediaIdFromHtml(html);

  if (baseInfo) {
    return {
      ...baseInfo,
      mediaId: mediaId || baseInfo.mediaId,
    };
  }

  if (mediaId) {
    try {
      const url = new URL(pageUrl);
      return { mediaId, baseUrl: url.origin };
    } catch {
      return null;
    }
  }

  return null;
}
