import type { DetectedVideo, VideoDetectionContext } from '../../types';
import type { Echo360Info } from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import { extractEcho360Info, isEcho360Url } from './urlUtils';

const HASH_SHIFT = 5;
const HASH_RADIX = 36;

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const firstNonEmptyString = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return null;
};

function generateVideoId(info: Echo360Info | null, embedUrl: string): string {
  if (info !== null && isNonEmptyString(info.mediaId)) return info.mediaId;
  if (info !== null && isNonEmptyString(info.lessonId)) return info.lessonId;
  let hash = 0;
  for (let i = 0; i < embedUrl.length; i++) {
    hash = (hash << HASH_SHIFT) - hash + embedUrl.charCodeAt(i);
    hash |= 0;
  }
  return `echo_${Math.abs(hash).toString(HASH_RADIX)}`;
}

function hasEcho360VideoIdentifiers(info: Echo360Info | null): info is Echo360Info {
  return info !== null && (isNonEmptyString(info.lessonId) || isNonEmptyString(info.mediaId));
}

export function detectEcho360Videos(context: VideoDetectionContext): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (url: string, title: string): void => {
    const info = extractEcho360Info(url);
    if (!hasEcho360VideoIdentifiers(info)) return;

    const id = generateVideoId(info, url);
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const video: DetectedVideo = {
      id,
      provider: 'echo360',
      title: title.length > 0 ? title : `Echo360 video ${videos.length + 1}`,
      embedUrl: url,
    };
    if (isNonEmptyString(info.lessonId)) video.echoLessonId = info.lessonId;
    if (isNonEmptyString(info.mediaId)) video.echoMediaId = info.mediaId;
    if (isNonEmptyString(info.baseUrl)) video.echoBaseUrl = info.baseUrl;
    videos.push(video);
  };

  if (isEcho360Url(context.pageUrl)) {
    const pageTitle = context.document?.title;
    addVideo(context.pageUrl, isNonEmptyString(pageTitle) ? pageTitle : '');
  }

  for (const iframe of context.iframes) {
    if (iframe.src.length > 0 && isEcho360Url(iframe.src)) {
      const iframeTitle = isNonEmptyString(iframe.title) ? iframe.title : '';
      addVideo(iframe.src, iframeTitle);
    }
  }

  return videos;
}

/**
 * Merge syllabus-derived metadata into a sync-detected video.
 */
export function mergeSyllabusMetadata(
  syncVideo: DetectedVideo,
  syllabusVideo: DetectedVideo,
): DetectedVideo {
  const resolvedId = syllabusVideo.id.length > 0 ? syllabusVideo.id : syncVideo.id;
  const resolvedTitle = syllabusVideo.title.length > 0 ? syllabusVideo.title : syncVideo.title;
  const merged: DetectedVideo = {
    ...syncVideo,
    id: resolvedId,
    title: resolvedTitle,
  };
  if (isNonEmptyString(syllabusVideo.echoLessonId)) {
    merged.echoLessonId = syllabusVideo.echoLessonId;
  }
  if (isNonEmptyString(syllabusVideo.echoMediaId)) {
    merged.echoMediaId = syllabusVideo.echoMediaId;
  }
  if (isNonEmptyString(syllabusVideo.echoBaseUrl)) {
    merged.echoBaseUrl = syllabusVideo.echoBaseUrl;
  }
  return merged;
}

function matchByMediaId(
  syllabusVideos: DetectedVideo[],
  mediaId: string,
  requestId: string,
  syncVideoId: string,
): DetectedVideo | null {
  const match = syllabusVideos.find(
    (video) => video.echoMediaId === mediaId || video.id === mediaId,
  );
  if (match === undefined) return null;
  log('debug', requestId, 'Matched syllabus video by mediaId', {
    mediaId,
    syncVideoId,
    syllabusVideoId: match.id,
  });
  return match;
}

function matchByLessonId(
  syllabusVideos: DetectedVideo[],
  lessonId: string,
  requestId: string,
  syncVideoId: string,
): DetectedVideo | null {
  const match = syllabusVideos.find(
    (video) => video.echoLessonId === lessonId || video.id === lessonId,
  );
  if (match === undefined) return null;
  log('debug', requestId, 'Matched syllabus video by lessonId', {
    lessonId,
    syncVideoId,
    syllabusVideoId: match.id,
  });
  return match;
}

function matchByEmbedUrl(
  syllabusVideos: DetectedVideo[],
  embedUrl: string,
  requestId: string,
  syncVideoId: string,
): DetectedVideo | null {
  const lowered = embedUrl.toLowerCase();
  const urlMatch = syllabusVideos.find((video) => {
    const mediaIdValue = video.echoMediaId;
    const lessonIdValue = video.echoLessonId;
    const mediaMatch =
      typeof mediaIdValue === 'string' && lowered.includes(mediaIdValue.toLowerCase());
    const lessonMatch =
      typeof lessonIdValue === 'string' && lowered.includes(lessonIdValue.toLowerCase());
    return mediaMatch || lessonMatch;
  });

  if (urlMatch === undefined) return null;
  log('debug', requestId, 'Matched syllabus video by URL', {
    syncVideoId,
    syllabusVideoId: urlMatch.id,
  });
  return urlMatch;
}

/**
 * Match a page-detected video with syllabus metadata.
 */
export function findMatchingSyllabusVideo(
  syncVideo: DetectedVideo,
  syllabusVideos: DetectedVideo[],
  requestId: string,
): DetectedVideo | null {
  if (syllabusVideos.length === 0) return null;

  const info = extractEcho360Info(syncVideo.embedUrl);
  const mediaId = firstNonEmptyString([syncVideo.echoMediaId, info?.mediaId]);
  const lessonId = firstNonEmptyString([syncVideo.echoLessonId, info?.lessonId]);

  if (mediaId !== null) {
    const match = matchByMediaId(syllabusVideos, mediaId, requestId, syncVideo.id);
    if (match !== null) return match;
  }

  if (lessonId !== null) {
    const match = matchByLessonId(syllabusVideos, lessonId, requestId, syncVideo.id);
    if (match !== null) return match;
  }

  const urlMatch = matchByEmbedUrl(syllabusVideos, syncVideo.embedUrl, requestId, syncVideo.id);
  if (urlMatch !== null) return urlMatch;

  log('debug', requestId, 'No syllabus match for video', { syncVideoId: syncVideo.id });
  return null;
}
