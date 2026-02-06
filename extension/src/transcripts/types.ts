import type { DetectedVideo, TranscriptExtractionResult } from '@core/transcripts/types';

export interface TranscriptMessage {
  type: 'EXTRACT_TRANSCRIPT';
  payload: {
    video: DetectedVideo;
  };
}

export interface TranscriptResponse {
  success: boolean;
  data?: TranscriptExtractionResult;
  error?: string;
}
