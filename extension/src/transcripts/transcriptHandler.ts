/**
 * Transcript Message Handler
 *
 * Handles transcript-related messages from content scripts.
 * Runs in the background service worker context.
 *
 * Delegates transcript extraction to core providers via fetcher interface.
 */

import type { DetectedVideo, TranscriptExtractionResult } from '@core/transcripts/types';
import type { TranscriptMessage, TranscriptResponse } from './types';
import { extractTranscriptForVideo } from './extraction';
import { fetchPanoptoMediaUrl } from './panoptoMedia';

export type { TranscriptMessage, TranscriptResponse };

/**
 * Extract transcript from a Panopto video
 */
export async function extractPanoptoTranscript(
  video: DetectedVideo,
): Promise<TranscriptExtractionResult> {
  return extractTranscriptForVideo(video);
}

/**
 * Handle transcript extraction message
 */
export async function handleTranscriptMessage(
  message: TranscriptMessage,
): Promise<TranscriptResponse> {
  if (message.type !== 'EXTRACT_TRANSCRIPT') {
    return {
      success: false,
      error: `Unknown message type: ${message.type}`,
    };
  }

  const { video } = message.payload;
  const result = await extractTranscriptForVideo(video);
  return {
    success: result.success,
    data: result,
  };
}
export { fetchPanoptoMediaUrl };
