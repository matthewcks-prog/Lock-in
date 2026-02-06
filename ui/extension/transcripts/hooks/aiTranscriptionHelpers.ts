import type { Dispatch, SetStateAction } from 'react';
import type { DetectedVideo } from '@core/transcripts/types';
import {
  sendToBackground,
  formatDurationForConfirm,
  LONG_DURATION_CONFIRM_MS,
  type AiTranscriptionState,
  type PanoptoMediaUrlResponse,
} from './types';

export async function resolvePanoptoMediaUrl(
  video: DetectedVideo,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
): Promise<DetectedVideo | null> {
  if (video.provider !== 'panopto' || video.mediaUrl) {
    return video;
  }

  setState({
    status: 'starting',
    requestId: null,
    jobId: null,
    video,
    progressMessage: 'Finding downloadable video URL... (checking if podcast download is enabled)',
    progressPercent: null,
    error: null,
  });

  try {
    const mediaUrlResponse = await sendToBackground<PanoptoMediaUrlResponse>({
      type: 'FETCH_PANOPTO_MEDIA_URL',
      payload: { video },
    });

    if (!mediaUrlResponse.success || !mediaUrlResponse.mediaUrl) {
      const errorMsg =
        mediaUrlResponse.error ||
        'Could not find video URL. The video may be restricted or require authentication.';
      setState({
        status: 'failed',
        requestId: null,
        jobId: null,
        video,
        progressMessage: null,
        progressPercent: null,
        error: errorMsg,
      });
      return null;
    }

    return { ...video, mediaUrl: mediaUrlResponse.mediaUrl };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Failed to prepare video for AI transcription';
    setState({
      status: 'failed',
      requestId: null,
      jobId: null,
      video,
      progressMessage: null,
      progressPercent: null,
      error: errorMsg,
    });
    return null;
  }
}

export function ensureVideoHasMediaUrl(
  video: DetectedVideo,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
): boolean {
  if (video.mediaUrl) return true;
  setState({
    status: 'failed',
    requestId: null,
    jobId: null,
    video,
    progressMessage: null,
    progressPercent: null,
    error: 'AI transcription is not available for this video.',
  });
  return false;
}

export function buildConfirmMessage(video: DetectedVideo): string {
  const durationLabel = formatDurationForConfirm(video.durationMs);
  const isLong =
    typeof video.durationMs === 'number' && video.durationMs >= LONG_DURATION_CONFIRM_MS;

  return isLong
    ? `This ${durationLabel ? `${durationLabel} ` : ''}video will be uploaded to Lock-in for AI transcription. This may take several minutes. Continue?`
    : 'This video will be uploaded to Lock-in for AI transcription. Continue?';
}
