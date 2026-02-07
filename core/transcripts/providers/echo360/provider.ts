import type { DetectedVideo, TranscriptExtractionResult, VideoDetectionContext } from '../../types';
import type { TranscriptProviderV2 } from '../../providerRegistry';
import type { AsyncFetcher } from '../../fetchers/types';
import { log } from '../../utils/echo360Logger';
import { detectEcho360Videos } from './detection';
import { detectEcho360VideosAsync } from './asyncDetection';
import { extractEcho360Transcript } from './transcriptExtraction';
import { isEcho360Url } from './urlUtils';

const REQUEST_ID_RADIX = 36;
const REQUEST_ID_RANDOM_SLICE_END = 6;

function createRequestId(): string {
  return `echo360-${Date.now().toString(REQUEST_ID_RADIX)}-${Math.random()
    .toString(REQUEST_ID_RADIX)
    .slice(2, REQUEST_ID_RANDOM_SLICE_END)}`;
}

// ============================================================================//
// Provider Class
// ============================================================================//

export class Echo360Provider implements TranscriptProviderV2 {
  readonly provider = 'echo360' as const;

  canHandle(url: string): boolean {
    return isEcho360Url(url);
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    // We may need async detection to resolve mediaId
    return true;
  }

  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    return detectEcho360Videos(context);
  }

  /**
   * Get a hint message when no Echo360 videos are detected.
   * Provides guidance for users on Echo360 section pages.
   */
  getEmptyDetectionHint(context: VideoDetectionContext): string | null {
    if (!isEcho360Url(context.pageUrl)) {
      return null;
    }
    return 'Echo360 tip: open a lesson page or the syllabus list to load videos.';
  }

  async detectVideosAsync(
    context: VideoDetectionContext,
    fetcher: AsyncFetcher,
  ): Promise<DetectedVideo[]> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting async detection', { pageUrl: context.pageUrl });
    return detectEcho360VideosAsync(context, fetcher, requestId);
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher,
  ): Promise<TranscriptExtractionResult> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting transcript extraction', {
      videoId: video.id,
      lessonId: video.echoLessonId,
      mediaId: video.echoMediaId,
    });

    return extractEcho360Transcript(video, fetcher, requestId);
  }
}

export function createEcho360Provider(): Echo360Provider {
  return new Echo360Provider();
}
