import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  sendToBackground,
  isAiTranscriptionBusy,
  type AiTranscriptionState,
  type AiTranscriptionResponse,
  type TranscriptResponseData,
} from './types';
import { ensureVideoHasMediaUrl, resolvePanoptoMediaUrl } from './aiTranscriptionHelpers';
import {
  cancelAiTranscriptionState,
  handleAiTranscriptionError,
  handleAiTranscriptionFailure,
  handleAiTranscriptionSuccess,
  resetAiTranscriptionState,
  startAiTranscriptionRequest,
} from './aiTranscriptionStateHandlers';

interface UseAiTranscriptionActionsArgs {
  state: AiTranscriptionState;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
  activeAiRequestIdRef: MutableRefObject<string | null>;
  onTranscriptReady?: (video: DetectedVideo, transcript: TranscriptResult) => void;
  onExtractionResult?: (videoId: string, result: TranscriptResponseData) => void;
}
export function useAiTranscriptionActions({
  state,
  setState,
  activeAiRequestIdRef,
  onTranscriptReady,
  onExtractionResult,
}: UseAiTranscriptionActionsArgs) {
  const isBusy = isAiTranscriptionBusy(state.status);
  const resolveVideo = useCallback(
    async (video: DetectedVideo) => {
      const resolvedVideo = await resolvePanoptoMediaUrl(video, setState);
      if (!resolvedVideo) return null;
      return ensureVideoHasMediaUrl(resolvedVideo, setState) ? resolvedVideo : null;
    },
    [setState],
  );
  const startRequest = useCallback(
    (video: DetectedVideo) => {
      return startAiTranscriptionRequest(video, setState, activeAiRequestIdRef);
    },
    [activeAiRequestIdRef, setState],
  );
  const handleSuccess = useCallback(
    (resolvedVideo: DetectedVideo, requestId: string, response: AiTranscriptionResponse) => {
      handleAiTranscriptionSuccess({
        resolvedVideo,
        requestId,
        response,
        setState,
        activeAiRequestIdRef,
        ...(onTranscriptReady ? { onTranscriptReady } : {}),
        ...(onExtractionResult ? { onExtractionResult } : {}),
      });
    },
    [activeAiRequestIdRef, onExtractionResult, onTranscriptReady, setState],
  );
  const handleFailure = useCallback(
    (resolvedVideo: DetectedVideo, requestId: string, response: AiTranscriptionResponse) => {
      handleAiTranscriptionFailure({
        resolvedVideo,
        requestId,
        response,
        setState,
        activeAiRequestIdRef,
      });
    },
    [activeAiRequestIdRef, setState],
  );
  const transcribeWithAI = useCallback(
    async (
      video: DetectedVideo,
      options?: { languageHint?: string; maxMinutes?: number },
    ): Promise<TranscriptResult | null> => {
      if (isAiTranscriptionBusy(state.status)) return null;
      const resolvedVideo = await resolveVideo(video);
      if (!resolvedVideo) return null;
      const requestId = startRequest(resolvedVideo);
      if (!requestId) return null;
      try {
        const response = await sendToBackground<AiTranscriptionResponse>({
          type: 'TRANSCRIBE_MEDIA_AI',
          payload: { video: resolvedVideo, options, requestId },
        });
        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }
        if (response.success && response.transcript) {
          handleSuccess(resolvedVideo, requestId, response);
          return response.transcript;
        }
        handleFailure(resolvedVideo, requestId, response);
        return null;
      } catch (error) {
        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }
        const message = error instanceof Error ? error.message : 'AI transcription failed';
        handleAiTranscriptionError({
          resolvedVideo,
          requestId,
          message,
          setState,
          activeAiRequestIdRef,
        });
        return null;
      }
    },
    [
      activeAiRequestIdRef,
      handleFailure,
      handleSuccess,
      resolveVideo,
      startRequest,
      state.status,
      setState,
    ],
  );
  const cancelAiTranscription = useCallback(async (): Promise<void> => {
    const requestId = state.requestId;
    const jobId = state.jobId;
    if (!requestId && !jobId) {
      return;
    }
    cancelAiTranscriptionState(setState, activeAiRequestIdRef);
    try {
      await sendToBackground<AiTranscriptionResponse>({
        type: 'TRANSCRIBE_MEDIA_AI',
        payload: { action: 'cancel', requestId, jobId },
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to cancel transcription',
        progressPercent: null,
      }));
    }
  }, [activeAiRequestIdRef, setState, state.jobId, state.requestId]);
  const resetAiTranscription = useCallback(() => {
    resetAiTranscriptionState(setState, activeAiRequestIdRef);
  }, [activeAiRequestIdRef, setState]);
  return {
    isBusy,
    transcribeWithAI,
    cancelAiTranscription,
    resetAiTranscription,
  };
}
