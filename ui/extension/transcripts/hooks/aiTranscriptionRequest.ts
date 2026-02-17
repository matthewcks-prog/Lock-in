import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  sendToBackground,
  isAiTranscriptionBusy,
  type AiTranscriptionState,
  type AiTranscriptionResponse,
} from './types';
import { handleAiTranscriptionError } from './aiTranscriptionStateHandlers';

type TranscriptionOptions = { languageHint?: string; maxMinutes?: number };

export interface ExecuteAiTranscriptionArgs {
  state: AiTranscriptionState;
  video: DetectedVideo;
  options: TranscriptionOptions | undefined;
  activeAiRequestIdRef: MutableRefObject<string | null>;
  resolveVideo: (video: DetectedVideo) => Promise<DetectedVideo | null>;
  startRequest: (video: DetectedVideo) => string | null;
  handleSuccess: (
    video: DetectedVideo,
    requestId: string,
    response: AiTranscriptionResponse,
  ) => void;
  handleFailure: (
    video: DetectedVideo,
    requestId: string,
    response: AiTranscriptionResponse,
  ) => void;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
}

function isStaleRequest(
  activeAiRequestIdRef: MutableRefObject<string | null>,
  requestId: string,
): boolean {
  return activeAiRequestIdRef.current !== requestId;
}

async function requestAiTranscription({
  resolvedVideo,
  options,
  requestId,
}: {
  resolvedVideo: DetectedVideo;
  options: TranscriptionOptions | undefined;
  requestId: string;
}): Promise<AiTranscriptionResponse> {
  return sendToBackground<AiTranscriptionResponse>({
    type: 'TRANSCRIBE_MEDIA_AI',
    payload: { video: resolvedVideo, options, requestId },
  });
}

function handleTranscriptionException({
  error,
  requestId,
  resolvedVideo,
  setState,
  activeAiRequestIdRef,
}: {
  error: unknown;
  requestId: string;
  resolvedVideo: DetectedVideo;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
  activeAiRequestIdRef: MutableRefObject<string | null>;
}): void {
  const message = error instanceof Error ? error.message : 'AI transcription failed';
  handleAiTranscriptionError({
    resolvedVideo,
    requestId,
    message,
    setState,
    activeAiRequestIdRef,
  });
}

export async function executeAiTranscription({
  state,
  video,
  options,
  activeAiRequestIdRef,
  resolveVideo,
  startRequest,
  handleSuccess,
  handleFailure,
  setState,
}: ExecuteAiTranscriptionArgs): Promise<TranscriptResult | null> {
  if (isAiTranscriptionBusy(state.status)) return null;

  const resolvedVideo = await resolveVideo(video);
  if (resolvedVideo === null) return null;

  const requestId = startRequest(resolvedVideo);
  if (requestId === null || requestId.length === 0) return null;

  try {
    const response = await requestAiTranscription({ resolvedVideo, options, requestId });
    if (isStaleRequest(activeAiRequestIdRef, requestId)) return null;
    if (response.success && response.transcript !== undefined) {
      handleSuccess(resolvedVideo, requestId, response);
      return response.transcript;
    }
    handleFailure(resolvedVideo, requestId, response);
    return null;
  } catch (error) {
    if (isStaleRequest(activeAiRequestIdRef, requestId)) return null;
    handleTranscriptionException({
      error,
      requestId,
      resolvedVideo,
      setState,
      activeAiRequestIdRef,
    });
    return null;
  }
}
