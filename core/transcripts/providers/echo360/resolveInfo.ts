import type { AsyncFetcher } from '../../fetchers/types';
import type { Echo360Info } from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import { fetchHtmlWithRedirect } from '../../utils/echo360Network';
import { extractMediaIdFromLessonInfo, parseEcho360InfoFromHtml } from './htmlParsing';
import { buildClassroomUrl, buildLessonInfoUrl } from './urlBuilders';
import { extractEcho360Info } from './urlUtils';

type ResolvableEchoInfo = Echo360Info & { lessonId: string; baseUrl: string };

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const firstNonEmptyString = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return null;
};

function asResolvableInfo(info: Echo360Info | null): ResolvableEchoInfo | null {
  if (info === null || !isNonEmptyString(info.lessonId) || !isNonEmptyString(info.baseUrl))
    return null;
  return {
    ...info,
    lessonId: info.lessonId,
    baseUrl: info.baseUrl,
  };
}

async function resolveFromClassroom(
  directInfo: ResolvableEchoInfo,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<Echo360Info | null> {
  try {
    const classroomUrl = buildClassroomUrl(directInfo.baseUrl, directInfo.lessonId);
    log('info', requestId, 'Fetching classroom page', { classroomUrl });

    const { html, finalUrl } = await fetchHtmlWithRedirect(classroomUrl, fetcher);
    log('info', requestId, 'Classroom page fetched', {
      htmlLength: html.length,
      finalUrl,
    });

    const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);
    if (!isNonEmptyString(htmlInfo?.mediaId)) {
      log('warn', requestId, 'No mediaId found in classroom HTML');
      return null;
    }

    const resolved: Echo360Info = {
      lessonId: directInfo.lessonId,
      mediaId: htmlInfo.mediaId,
      baseUrl: directInfo.baseUrl,
    };
    log('info', requestId, 'Resolved mediaId from classroom HTML', {
      mediaId: resolved.mediaId,
    });
    return resolved;
  } catch (error) {
    log('warn', requestId, 'Classroom fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveFromLessonApi(
  directInfo: ResolvableEchoInfo,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<Echo360Info | null> {
  try {
    const lessonInfoUrl = buildLessonInfoUrl(directInfo.baseUrl, directInfo.lessonId);
    log('info', requestId, 'Fetching lesson info from API', { lessonInfoUrl });

    const lessonData = await fetcher.fetchJson<unknown>(lessonInfoUrl);
    const hasData = lessonData !== null && lessonData !== undefined;
    log('info', requestId, 'Lesson info fetched', {
      hasData,
      dataType: typeof lessonData,
    });

    const mediaId = extractMediaIdFromLessonInfo(lessonData);
    if (mediaId === null) {
      log('warn', requestId, 'No mediaId found in lesson API response');
      return null;
    }

    const resolved: Echo360Info = {
      lessonId: directInfo.lessonId,
      mediaId,
      baseUrl: directInfo.baseUrl,
    };
    log('info', requestId, 'Resolved mediaId from lesson API', {
      mediaId: resolved.mediaId,
    });
    return resolved;
  } catch (error) {
    log('warn', requestId, 'Lesson info API fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveFromEmbedFetch(
  embedUrl: string,
  directInfo: Echo360Info | null,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<Echo360Info | null> {
  try {
    log('info', requestId, 'Fetching embed URL directly', { embedUrl });
    const { html, finalUrl } = await fetchHtmlWithRedirect(embedUrl, fetcher);

    const urlInfo = extractEcho360Info(finalUrl);
    const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);

    const lessonId = firstNonEmptyString([
      urlInfo?.lessonId,
      htmlInfo?.lessonId,
      directInfo?.lessonId,
    ]);
    const mediaId = firstNonEmptyString([urlInfo?.mediaId, htmlInfo?.mediaId]);
    const baseUrl = firstNonEmptyString([urlInfo?.baseUrl, htmlInfo?.baseUrl, directInfo?.baseUrl]);

    if (lessonId !== null && mediaId !== null && baseUrl !== null) {
      log('info', requestId, 'Resolved from embed URL fetch', { lessonId, mediaId });
      return { lessonId, mediaId, baseUrl };
    }
  } catch (error) {
    log('warn', requestId, 'Embed URL fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

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

  if (
    directInfo !== null &&
    isNonEmptyString(directInfo.lessonId) &&
    isNonEmptyString(directInfo.mediaId)
  ) {
    log('info', requestId, 'Resolved from direct URL');
    return directInfo;
  }

  const resolvableInfo = asResolvableInfo(directInfo);
  if (resolvableInfo !== null) {
    const fromClassroom = await resolveFromClassroom(resolvableInfo, fetcher, requestId);
    if (fromClassroom !== null) return fromClassroom;

    const fromLessonApi = await resolveFromLessonApi(resolvableInfo, fetcher, requestId);
    if (fromLessonApi !== null) return fromLessonApi;
  }

  const fromEmbed = await resolveFromEmbedFetch(embedUrl, directInfo, fetcher, requestId);
  if (fromEmbed !== null) return fromEmbed;

  log('warn', requestId, 'Could not resolve complete Echo360 info');
  return directInfo;
}
