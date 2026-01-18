import type { DetectedVideo, VideoDetectionContext } from '../../types';
import type { Echo360Info } from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import { extractEcho360Info, isEcho360Url } from './urlUtils';

function generateVideoId(info: Echo360Info | null, embedUrl: string): string {
  if (info?.mediaId) return info.mediaId;
  if (info?.lessonId) return info.lessonId;
  let hash = 0;
  for (let i = 0; i < embedUrl.length; i++) {
    hash = (hash << 5) - hash + embedUrl.charCodeAt(i);
    hash |= 0;
  }
  return `echo_${Math.abs(hash).toString(36)}`;
}

function hasEcho360VideoIdentifiers(info: Echo360Info | null): info is Echo360Info {
  return Boolean(info && (info.lessonId || info.mediaId));
}

export function detectEcho360Videos(context: VideoDetectionContext): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (url: string, title: string) => {
    const info = extractEcho360Info(url);
    if (!hasEcho360VideoIdentifiers(info)) return;

    const id = generateVideoId(info, url);
    if (seenIds.has(id)) return;
    seenIds.add(id);

    videos.push({
      id,
      provider: 'echo360',
      title: title || `Echo360 video ${videos.length + 1}`,
      embedUrl: url,
      echoLessonId: info.lessonId,
      echoMediaId: info.mediaId,
      echoBaseUrl: info.baseUrl,
    });
  };

  if (isEcho360Url(context.pageUrl)) {
    addVideo(context.pageUrl, context.document?.title || '');
  }

  for (const iframe of context.iframes) {
    if (iframe.src && isEcho360Url(iframe.src)) {
      addVideo(iframe.src, iframe.title || '');
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
  return {
    ...syncVideo,
    id: syllabusVideo.id || syncVideo.id,
    title: syllabusVideo.title || syncVideo.title,
    echoLessonId: syllabusVideo.echoLessonId || syncVideo.echoLessonId,
    echoMediaId: syllabusVideo.echoMediaId || syncVideo.echoMediaId,
    echoBaseUrl: syllabusVideo.echoBaseUrl || syncVideo.echoBaseUrl,
  };
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
  const mediaId = syncVideo.echoMediaId || info?.mediaId;
  const lessonId = syncVideo.echoLessonId || info?.lessonId;

  if (mediaId) {
    const match = syllabusVideos.find(
      (video) => video.echoMediaId === mediaId || video.id === mediaId,
    );
    if (match) {
      log('debug', requestId, 'Matched syllabus video by mediaId', {
        mediaId,
        syncVideoId: syncVideo.id,
        syllabusVideoId: match.id,
      });
      return match;
    }
  }

  if (lessonId) {
    const match = syllabusVideos.find(
      (video) => video.echoLessonId === lessonId || video.id === lessonId,
    );
    if (match) {
      log('debug', requestId, 'Matched syllabus video by lessonId', {
        lessonId,
        syncVideoId: syncVideo.id,
        syllabusVideoId: match.id,
      });
      return match;
    }
  }

  const embedUrl = syncVideo.embedUrl.toLowerCase();
  const urlMatch = syllabusVideos.find((video) => {
    const mediaMatch = video.echoMediaId && embedUrl.includes(video.echoMediaId.toLowerCase());
    const lessonMatch = video.echoLessonId && embedUrl.includes(video.echoLessonId.toLowerCase());
    return Boolean(mediaMatch || lessonMatch);
  });

  if (urlMatch) {
    log('debug', requestId, 'Matched syllabus video by URL', {
      syncVideoId: syncVideo.id,
      syllabusVideoId: urlMatch.id,
    });
    return urlMatch;
  }

  log('debug', requestId, 'No syllabus match for video', { syncVideoId: syncVideo.id });
  return null;
}
