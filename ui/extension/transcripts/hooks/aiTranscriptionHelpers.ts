import type { Dispatch, SetStateAction } from 'react';
import type { DetectedVideo } from '@core/transcripts/types';
import {
  sendToBackground,
  formatDurationForConfirm,
  LONG_DURATION_CONFIRM_MS,
  type AiTranscriptionState,
  type PanoptoMediaUrlResponse,
} from './types';

function setAiFailedState(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  video: DetectedVideo,
  error: string,
): void {
  setState({
    status: 'failed',
    requestId: null,
    jobId: null,
    video,
    progressMessage: null,
    progressPercent: null,
    error,
  });
}

function resolveMediaUrlError(response: PanoptoMediaUrlResponse): string {
  if (response.error !== undefined && response.error.length > 0) {
    return response.error;
  }
  return 'Could not find video URL. The video may be restricted or require authentication.';
}

export async function resolvePanoptoMediaUrl(
  video: DetectedVideo,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
): Promise<DetectedVideo | null> {
  const hasMediaUrl =
    video.mediaUrl !== null && video.mediaUrl !== undefined && video.mediaUrl.length > 0;
  if (video.provider !== 'panopto' || hasMediaUrl) {
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

    const mediaUrl = mediaUrlResponse.mediaUrl;
    if (!mediaUrlResponse.success || mediaUrl === undefined || mediaUrl.length === 0) {
      setAiFailedState(setState, video, resolveMediaUrlError(mediaUrlResponse));
      return null;
    }

    return { ...video, mediaUrl };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to prepare video for AI transcription';
    setAiFailedState(setState, video, message);
    return null;
  }
}

export function ensureVideoHasMediaUrl(
  video: DetectedVideo,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
): boolean {
  if (video.mediaUrl !== null && video.mediaUrl !== undefined && video.mediaUrl.length > 0) {
    return true;
  }
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

  const prefix = durationLabel !== null && durationLabel.length > 0 ? `${durationLabel} ` : '';
  return isLong
    ? `This ${prefix}video will be uploaded to Lock-in for AI transcription. This may take several minutes. Continue?`
    : 'This video will be uploaded to Lock-in for AI transcription. Continue?';
}
