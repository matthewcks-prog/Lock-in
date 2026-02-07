import type { DetectedVideo, VideoDetectionContext } from '../../types';
import type { AsyncFetcher } from '../../fetchers/types';
import { log } from '../../utils/echo360Logger';
import {
  extractSectionId,
  fetchVideosFromSyllabus,
  getUniqueKey,
} from '../../parsers/echo360Parser';
import { detectEcho360Videos, findMatchingSyllabusVideo, mergeSyllabusMetadata } from './detection';
import { resolveEcho360Info } from './resolveInfo';
import { isEcho360SectionPage } from './urlUtils';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

async function fetchSyllabusVideos(
  context: VideoDetectionContext,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const sectionId = extractSectionId(context.pageUrl);
  if (sectionId === null) {
    return [];
  }
  log('info', requestId, 'Section ID detected, fetching syllabus', { sectionId });
  return fetchVideosFromSyllabus(context.pageUrl, fetcher, requestId);
}

function mergeSyllabusVideos(
  syncVideos: DetectedVideo[],
  syllabusVideos: DetectedVideo[],
  requestId: string,
): { mergedVideos: DetectedVideo[]; matchedCount: number } {
  if (syllabusVideos.length === 0) {
    return { mergedVideos: syncVideos, matchedCount: 0 };
  }

  let matchedCount = 0;
  const mergedVideos = syncVideos.map((video) => {
    const match = findMatchingSyllabusVideo(video, syllabusVideos, requestId);
    if (match !== null) {
      matchedCount += 1;
      return mergeSyllabusMetadata(video, match);
    }
    return video;
  });

  log('info', requestId, 'Merged syllabus metadata', {
    matchedCount,
    totalSyncVideos: syncVideos.length,
  });

  return { mergedVideos, matchedCount };
}

async function enhanceVideosWithMediaIds(
  videos: DetectedVideo[],
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const enhancedVideos: DetectedVideo[] = [];
  const seenKeys = new Set<string>();

  for (const video of videos) {
    let updated = video;
    if (!isNonEmptyString(video.echoMediaId)) {
      const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
      if (isNonEmptyString(resolved?.mediaId)) {
        updated = {
          ...video,
          echoMediaId: resolved.mediaId,
        };
        if (isNonEmptyString(resolved.lessonId)) {
          updated.echoLessonId = resolved.lessonId;
        }
        if (isNonEmptyString(resolved.baseUrl)) {
          updated.echoBaseUrl = resolved.baseUrl;
        }
      }
    }

    const key =
      getUniqueKey(updated.echoMediaId ?? null, updated.echoLessonId ?? null) ?? updated.id;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    enhancedVideos.push(updated);
  }

  return enhancedVideos;
}

export async function detectEcho360VideosAsync(
  context: VideoDetectionContext,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const syllabusVideos = await fetchSyllabusVideos(context, fetcher, requestId);

  if (isEcho360SectionPage(context.pageUrl)) {
    if (syllabusVideos.length > 0) {
      log('info', requestId, 'Syllabus detection complete', {
        count: syllabusVideos.length,
        withMediaId: syllabusVideos.filter((v) => isNonEmptyString(v.echoMediaId)).length,
      });
      return syllabusVideos;
    }
    log('info', requestId, 'No videos from syllabus, falling back to standard detection');
  }

  const syncVideos = detectEcho360Videos(context);

  if (syncVideos.length === 0) {
    log('info', requestId, 'No videos found in sync detection');
    return [];
  }

  const { mergedVideos } = mergeSyllabusVideos(syncVideos, syllabusVideos, requestId);
  const enhancedVideos = await enhanceVideosWithMediaIds(mergedVideos, fetcher, requestId);

  log('info', requestId, 'Async detection complete', {
    count: enhancedVideos.length,
    withMediaId: enhancedVideos.filter((v) => isNonEmptyString(v.echoMediaId)).length,
  });

  return enhancedVideos;
}
