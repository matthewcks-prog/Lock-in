/**
 * Transcript Providers
 * 
 * Registry of all transcript provider implementations.
 */

import type { TranscriptProvider, DetectedVideo, VideoDetectionContext } from '@core/transcripts/types';
import { PanoptoTranscriptProvider } from './panoptoProvider';
import { Echo360TranscriptProvider } from './echo360Provider';

// Registry of all providers
const providers: TranscriptProvider[] = [
  new PanoptoTranscriptProvider(),
  new Echo360TranscriptProvider(),
];


/**
 * Get the appropriate provider for a given URL
 */
export function getProviderForUrl(url: string): TranscriptProvider | null {
  for (const provider of providers) {
    if (provider.canHandle(url)) {
      return provider;
    }
  }
  return null;
}

/**
 * Detect all videos on a page using all providers
 */
export function detectAllVideos(context: VideoDetectionContext): DetectedVideo[] {
  const allVideos: DetectedVideo[] = [];
  
  for (const provider of providers) {
    const videos = provider.detectVideos(context);
    allVideos.push(...videos);
  }
  
  return allVideos;
}

/**
 * Get provider by type
 */
export function getProviderByType(providerType: string): TranscriptProvider | null {
  return providers.find(p => p.provider === providerType) || null;
}

export {
  PanoptoTranscriptProvider,
  extractCaptionVttUrl,
  extractDeliveryId,
  extractTenantDomain,
  createPanoptoProvider,
} from './panoptoProvider';

export {
  Echo360TranscriptProvider,
  ECHO360_HOSTS,
  isEcho360Domain,
  isEcho360Url,
  extractEcho360Origin,
  extractSectionId,
  extractLessonId,
  extractMediaId,
  extractEcho360Context,
  createEcho360Provider,
} from './echo360Provider';
