import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  mapStageToStatus,
  INITIAL_AI_TRANSCRIPTION_STATE,
  type AiTranscriptionResponse,
  type AiTranscriptionState,
  type TranscriptResponseData,
} from './types';
import { buildConfirmMessage } from './aiTranscriptionHelpers';

function createRequestId() {
  return `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function startAiTranscriptionRequest(
  video: DetectedVideo,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  activeAiRequestIdRef: MutableRefObject<string | null>,
): string | null {
  const confirmMessage = buildConfirmMessage(video);
  if (!window.confirm(confirmMessage)) return null;

  const requestId = createRequestId();
  activeAiRequestIdRef.current = requestId;
  setState({
    status: 'starting',
    requestId,
    jobId: null,
    video,
    progressMessage: 'No transcript available - transcribing with AI... This may take a minute.',
    progressPercent: null,
    error: null,
  });
  return requestId;
}

export function handleAiTranscriptionSuccess({
  resolvedVideo,
  requestId,
  response,
  setState,
  activeAiRequestIdRef,
  onTranscriptReady,
  onExtractionResult,
}: {
  resolvedVideo: DetectedVideo;
  requestId: string;
  response: AiTranscriptionResponse;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
  activeAiRequestIdRef: MutableRefObject<string | null>;
  onTranscriptReady?: (video: DetectedVideo, transcript: TranscriptResult) => void;
  onExtractionResult?: (videoId: string, result: TranscriptResponseData) => void;
}) {
  if (!response.transcript) return;
  setState({
    status: 'completed',
    requestId,
    jobId: response.jobId || null,
    video: resolvedVideo,
    progressMessage: 'Transcript ready',
    progressPercent: 100,
    error: null,
  });

  onTranscriptReady?.(resolvedVideo, response.transcript);
  onExtractionResult?.(resolvedVideo.id, { success: true, transcript: response.transcript });
  activeAiRequestIdRef.current = null;
}

export function handleAiTranscriptionFailure({
  resolvedVideo,
  requestId,
  response,
  setState,
  activeAiRequestIdRef,
}: {
  resolvedVideo: DetectedVideo;
  requestId: string;
  response: AiTranscriptionResponse;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
  activeAiRequestIdRef: MutableRefObject<string | null>;
}) {
  const errorMessage = response.error || 'AI transcription failed';
  const fallbackStatus = response.status === 'canceled' ? 'canceled' : 'failed';
  const nextStatus = mapStageToStatus(response.status, fallbackStatus);

  setState((prev) => ({
    status: nextStatus,
    requestId,
    jobId: response.jobId || prev.jobId,
    video: resolvedVideo,
    progressMessage: null,
    progressPercent: null,
    error: errorMessage,
  }));

  activeAiRequestIdRef.current = null;
}

export function handleAiTranscriptionError({
  resolvedVideo,
  requestId,
  message,
  setState,
  activeAiRequestIdRef,
}: {
  resolvedVideo: DetectedVideo;
  requestId: string;
  message: string;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
  activeAiRequestIdRef: MutableRefObject<string | null>;
}) {
  setState((prev) => ({
    status: 'failed',
    requestId,
    jobId: prev.jobId,
    video: resolvedVideo,
    progressMessage: null,
    progressPercent: null,
    error: message,
  }));
  activeAiRequestIdRef.current = null;
}

export function cancelAiTranscriptionState(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  activeAiRequestIdRef: MutableRefObject<string | null>,
) {
  activeAiRequestIdRef.current = null;
  setState((prev) => ({
    ...prev,
    status: 'canceled',
    progressMessage: 'Transcription canceled',
    progressPercent: null,
    error: null,
  }));
}

export function resetAiTranscriptionState(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  activeAiRequestIdRef: MutableRefObject<string | null>,
) {
  activeAiRequestIdRef.current = null;
  setState(INITIAL_AI_TRANSCRIPTION_STATE);
}
