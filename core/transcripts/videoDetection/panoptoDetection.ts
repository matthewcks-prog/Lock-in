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
    videos.push({
      id: info.deliveryId,
      provider: 'panopto',
      title: title || `Panopto video ${videos.length + 1}`,
      embedUrl,
      panoptoTenant: info.tenant,
    });
  };

  if (pageUrl) {
    const pageInfo = extractPanoptoInfo(pageUrl);
    if (pageInfo) {
      addVideo(pageInfo, '');
    }
  }

  for (const iframe of iframes) {
    if (!iframe.src) continue;
    const info = extractPanoptoInfo(iframe.src);
    if (info) {
      addVideo(info, iframe.title || '');
    }
  }

  return videos;
}
