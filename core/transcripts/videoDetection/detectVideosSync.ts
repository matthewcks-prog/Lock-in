import type { DetectedVideo, VideoDetectionContext, VideoProvider } from '../types';
import { detectEcho360Videos } from '../providers/echo360Provider';
import { detectPanoptoVideosFromIframes } from './panoptoDetection';
import { detectHtml5Videos } from './html5Detection';

/**
 * Result of synchronous video detection
 */
export type VideoDetectionResult = {
  /** Detected videos (may be empty if API call required) */
  videos: DetectedVideo[];
  /** Which provider was detected */
  provider: VideoProvider | null;
  /** Whether an API call is required to get full video list */
  requiresApiCall: boolean;
};

/**
 * Detect videos synchronously from page context.
 */
export function detectVideosSync(context: VideoDetectionContext): VideoDetectionResult {
  const panoptoFromIframes = detectPanoptoVideosFromIframes(context.iframes, context.pageUrl);

  if (panoptoFromIframes.length > 0) {
    return {
      videos: panoptoFromIframes,
      provider: 'panopto' as VideoProvider,
      requiresApiCall: false,
    };
  }

  const echoVideos = detectEcho360Videos(context);
  if (echoVideos.length > 0) {
    return {
      videos: echoVideos,
      provider: 'echo360' as VideoProvider,
      requiresApiCall: false,
    };
  }

  const html5Videos = detectHtml5Videos(context);
  if (html5Videos.length > 0) {
    return {
      videos: html5Videos,
      provider: 'html5' as VideoProvider,
      requiresApiCall: false,
    };
  }

  return {
    videos: [],
    provider: null,
    requiresApiCall: false,
  };
}
