import type { DetectedVideo, VideoDetectionContext } from '../types';
import {
  buildPanoptoEmbedUrl,
  extractPanoptoInfo,
  type PanoptoInfo,
} from '../providers/panoptoProvider';

/**
 * Detect Panopto videos from iframe list
 * Note: This is a legacy function. For comprehensive detection,
 * use detectVideosSync() or PanoptoProvider.detectVideosSync().
 */
export function detectPanoptoVideosFromIframes(
  iframes: VideoDetectionContext['iframes'],
  pageUrl?: string,
): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (info: PanoptoInfo, title: string): void => {
    if (seenIds.has(info.deliveryId)) return;
    seenIds.add(info.deliveryId);
    const embedUrl = buildPanoptoEmbedUrl(info.tenant, info.deliveryId);
    const resolvedTitle = title.trim().length > 0 ? title : `Panopto video ${videos.length + 1}`;
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: resolvedTitle,
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };

  if (typeof pageUrl === 'string' && pageUrl.length > 0) {
    const pageInfo = extractPanoptoInfo(pageUrl);
    if (pageInfo !== null) {
      addVideo(pageInfo, '');
    }
  }

  for (const iframe of iframes) {
    if (iframe.src.length === 0) continue;
    const info = extractPanoptoInfo(iframe.src);
    if (info !== null) {
      const iframeTitle = typeof iframe.title === 'string' ? iframe.title : '';
      addVideo(info, iframeTitle.length > 0 ? iframeTitle : '');
    }
  }

  return videos;
}
