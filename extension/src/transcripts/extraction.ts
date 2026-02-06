import type { DetectedVideo, TranscriptExtractionResult } from '@core/transcripts/types';
import { BackgroundFetcher } from './fetcher';
import { ensureProvidersRegistered, getProviderForVideo } from './providers';

export async function extractTranscriptForVideo(
  video: DetectedVideo,
): Promise<TranscriptExtractionResult> {
  if (!video || !video.provider) {
    return {
      success: false,
      error: 'No video provider specified',
      errorCode: 'INVALID_VIDEO',
      aiTranscriptionAvailable: true,
    };
  }

  ensureProvidersRegistered();
  const provider = getProviderForVideo(video);
  if (!provider || typeof provider.extractTranscript !== 'function') {
    return {
      success: false,
      error: `Unsupported video provider: ${video.provider}`,
      errorCode: 'NOT_AVAILABLE',
      aiTranscriptionAvailable: true,
    };
  }

  const fetcher = new BackgroundFetcher();
  try {
    return await provider.extractTranscript(video, fetcher);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message || 'Failed to extract transcript',
      errorCode: 'NOT_AVAILABLE',
      aiTranscriptionAvailable: true,
    };
  }
}
