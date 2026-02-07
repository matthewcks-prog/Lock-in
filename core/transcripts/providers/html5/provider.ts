import type { DetectedVideo, TranscriptExtractionResult, VideoDetectionContext } from '../../types';
import type { TranscriptProviderV2 } from '../../providerRegistry';
import type { AsyncFetcher } from '../../fetchers/types';
import { parseWebVtt } from '../../webvttParser';

type TrackError = {
  error: string;
  errorCode: NonNullable<TranscriptExtractionResult['errorCode']>;
};

const isNetworkError = (message: string): boolean =>
  message.includes('Failed to fetch') ||
  message.includes('NetworkError') ||
  message.includes('CORS') ||
  message.includes('Network request failed');

function buildNoCaptionsResult(aiAvailable: boolean): TranscriptExtractionResult {
  return {
    success: false,
    error: 'No captions found',
    errorCode: 'NO_CAPTIONS',
    aiTranscriptionAvailable: aiAvailable,
  };
}

function buildAuthRequiredResult(aiAvailable: boolean): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Authentication required to access captions.',
    errorCode: 'AUTH_REQUIRED',
    aiTranscriptionAvailable: aiAvailable,
  };
}

function buildTrackFailureResult(
  aiAvailable: boolean,
  error: TrackError,
): TranscriptExtractionResult {
  return {
    success: false,
    error: error.error,
    errorCode: error.errorCode,
    aiTranscriptionAvailable: aiAvailable,
  };
}

function buildFetchError(message: string): TrackError {
  if (isNetworkError(message)) {
    return {
      error: 'Captions could not be fetched due to browser restrictions or network errors.',
      errorCode: 'NOT_AVAILABLE',
    };
  }
  return {
    error: `Failed to fetch captions: ${message}`,
    errorCode: 'NOT_AVAILABLE',
  };
}

function buildParseError(): TrackError {
  return {
    error: 'Caption file is empty or could not be parsed',
    errorCode: 'PARSE_ERROR',
  };
}

export class Html5Provider implements TranscriptProviderV2 {
  readonly provider = 'html5' as const;

  canHandle(_url: string): boolean {
    return false;
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    return false;
  }

  detectVideosSync(_context: VideoDetectionContext): DetectedVideo[] {
    return [];
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher,
  ): Promise<TranscriptExtractionResult> {
    const tracks = Array.isArray(video.trackUrls) ? video.trackUrls : [];
    const aiAvailable = Boolean(video.mediaUrl);

    if (tracks.length === 0) {
      return buildNoCaptionsResult(aiAvailable);
    }

    let lastError: TrackError | null = null;

    for (const track of tracks) {
      if (track.src.length === 0) continue;
      try {
        const vttContent = await fetcher.fetchWithCredentials(track.src);
        const transcript = parseWebVtt(vttContent);

        if (transcript.segments.length > 0) {
          return { success: true, transcript };
        }

        lastError = buildParseError();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message === 'AUTH_REQUIRED') {
          return buildAuthRequiredResult(aiAvailable);
        }

        lastError = buildFetchError(message);
      }
    }

    if (lastError !== null) {
      return buildTrackFailureResult(aiAvailable, lastError);
    }

    return buildNoCaptionsResult(aiAvailable);
  }
}

export function createHtml5Provider(): Html5Provider {
  return new Html5Provider();
}
