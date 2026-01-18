import type { AsyncFetcher } from '../../fetchers/types';
import type { Echo360Info } from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import { fetchHtmlWithRedirect } from '../../utils/echo360Network';
import { extractMediaIdFromLessonInfo, parseEcho360InfoFromHtml } from './htmlParsing';
import { buildClassroomUrl, buildLessonInfoUrl } from './urlBuilders';
import { extractEcho360Info } from './urlUtils';

/**
 * Resolve complete Echo360 info (lessonId + mediaId) from embed URL
 * Uses multiple strategies:
 * 1. Direct URL parsing
 * 2. Fetch classroom page and extract from HTML
 */
export async function resolveEcho360Info(
  embedUrl: string,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<Echo360Info | null> {
  log('info', requestId, 'Resolving Echo360 info', { embedUrl });

  const directInfo = extractEcho360Info(embedUrl);
  log('info', requestId, 'Direct URL extraction', {
    lessonId: directInfo?.lessonId,
    mediaId: directInfo?.mediaId,
    baseUrl: directInfo?.baseUrl,
  });

  if (directInfo?.lessonId && directInfo?.mediaId) {
    log('info', requestId, 'Resolved from direct URL');
    return directInfo;
  }

  if (directInfo?.lessonId && directInfo?.baseUrl) {
    try {
      const classroomUrl = buildClassroomUrl(directInfo.baseUrl, directInfo.lessonId);
      log('info', requestId, 'Fetching classroom page', { classroomUrl });

      const { html, finalUrl } = await fetchHtmlWithRedirect(classroomUrl, fetcher);
      log('info', requestId, 'Classroom page fetched', {
        htmlLength: html.length,
        finalUrl,
      });

      const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);
      if (htmlInfo?.mediaId) {
        const resolved: Echo360Info = {
          lessonId: directInfo.lessonId,
          mediaId: htmlInfo.mediaId,
          baseUrl: directInfo.baseUrl,
        };
        log('info', requestId, 'Resolved mediaId from classroom HTML', {
          mediaId: resolved.mediaId,
        });
        return resolved;
      }

      log('warn', requestId, 'No mediaId found in classroom HTML');
    } catch (error) {
      log('warn', requestId, 'Classroom fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const lessonInfoUrl = buildLessonInfoUrl(directInfo.baseUrl, directInfo.lessonId);
      log('info', requestId, 'Fetching lesson info from API', { lessonInfoUrl });

      const lessonData = await fetcher.fetchJson<unknown>(lessonInfoUrl);
      log('info', requestId, 'Lesson info fetched', {
        hasData: !!lessonData,
        dataType: typeof lessonData,
      });

      const mediaId = extractMediaIdFromLessonInfo(lessonData);
      if (mediaId) {
        const resolved: Echo360Info = {
          lessonId: directInfo.lessonId,
          mediaId,
          baseUrl: directInfo.baseUrl,
        };
        log('info', requestId, 'Resolved mediaId from lesson API', {
          mediaId: resolved.mediaId,
        });
        return resolved;
      }

      log('warn', requestId, 'No mediaId found in lesson API response');
    } catch (error) {
      log('warn', requestId, 'Lesson info API fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    log('info', requestId, 'Fetching embed URL directly', { embedUrl });
    const { html, finalUrl } = await fetchHtmlWithRedirect(embedUrl, fetcher);

    const urlInfo = extractEcho360Info(finalUrl);
    const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);

    const lessonId = urlInfo?.lessonId || htmlInfo?.lessonId || directInfo?.lessonId;
    const mediaId = urlInfo?.mediaId || htmlInfo?.mediaId;
    const baseUrl = urlInfo?.baseUrl || htmlInfo?.baseUrl || directInfo?.baseUrl;

    if (lessonId && mediaId && baseUrl) {
      log('info', requestId, 'Resolved from embed URL fetch', { lessonId, mediaId });
      return { lessonId, mediaId, baseUrl };
    }
  } catch (error) {
    log('warn', requestId, 'Embed URL fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  log('warn', requestId, 'Could not resolve complete Echo360 info');
  return directInfo;
}
