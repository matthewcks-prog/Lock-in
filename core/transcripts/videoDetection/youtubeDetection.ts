import type { DetectedVideo, VideoDetectionContext } from '../types';
import {
  extractYouTubeInfo,
  buildYouTubeEmbedUrl,
} from '../providers/youtubeProvider';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Detect YouTube videos from page URL and iframes.
 */
export function detectYouTubeVideos(context: VideoDetectionContext): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (videoId: string, title: string): void => {
    if (seenIds.has(videoId)) return;
    seenIds.add(videoId);
    videos.push({
      id: videoId,
      provider: 'youtube',
      title: title.length > 0 ? title : `YouTube video ${videos.length + 1}`,
      embedUrl: buildYouTubeEmbedUrl(videoId),
    });
  };

  const pageInfo = extractYouTubeInfo(context.pageUrl);
  if (pageInfo !== null) {
    addVideo(pageInfo.videoId, '');
  }

  for (const iframe of context.iframes) {
    if (iframe.src.length === 0) continue;
    const info = extractYouTubeInfo(iframe.src);
    if (info !== null) {
      const iframeTitle = isNonEmptyString(iframe.title) ? iframe.title : '';
      addVideo(info.videoId, iframeTitle);
    }
  }

  return videos;
}
