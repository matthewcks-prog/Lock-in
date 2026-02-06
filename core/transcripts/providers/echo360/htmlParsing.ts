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

  const medias = data['medias'];
  if (Array.isArray(medias) && medias.length > 0) {
    const firstMedia = medias[0] as Record<string, unknown> | undefined;
    const firstMediaId = firstMedia?.['id'];
    if (typeof firstMediaId === 'string') {
      return firstMediaId.toLowerCase();
    }
    const firstMediaMediaId = firstMedia?.['mediaId'];
    if (typeof firstMediaMediaId === 'string') {
      return firstMediaMediaId.toLowerCase();
    }
  }

  if (data['data'] && typeof data['data'] === 'object') {
    return extractMediaIdFromLessonInfo(data['data']);
  }

  if (data['lesson'] && typeof data['lesson'] === 'object') {
    return extractMediaIdFromLessonInfo(data['lesson']);
  }

  const nestedKeys = ['video', 'media', 'content', 'sections'];
  for (const key of nestedKeys) {
    if (data[key] && typeof data[key] === 'object') {
      const nested = data[key] as Record<string, unknown>;
      const nestedMedias = nested['medias'];
      if (Array.isArray(nestedMedias) && nestedMedias.length > 0) {
        const firstMedia = nestedMedias[0] as Record<string, unknown> | undefined;
        const nestedMediaId = firstMedia?.['id'];
        if (typeof nestedMediaId === 'string') {
          return nestedMediaId.toLowerCase();
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
    if (mediaId) {
      return {
        ...baseInfo,
        mediaId,
      };
    }
    return baseInfo;
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
