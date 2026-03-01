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
import { executeAiTranscription } from './aiTranscriptionRequest';
import {
  cancelAiTranscriptionState,
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

interface UseAiTranscriptionActionsResult {
  isBusy: boolean;
  transcribeWithAI: (
    video: DetectedVideo,
    options?: { languageHint?: string; maxMinutes?: number },
  ) => Promise<TranscriptResult | null>;
  cancelAiTranscription: () => Promise<void>;
  resetAiTranscription: () => void;
}

type TranscriptionOptions = { languageHint?: string; maxMinutes?: number };

type OptionalCallbacks = {
  onTranscriptReady: ((video: DetectedVideo, transcript: TranscriptResult) => void) | undefined;
  onExtractionResult: ((videoId: string, result: TranscriptResponseData) => void) | undefined;
};
type TranscribeWithAiFn = (
  video: DetectedVideo,
  options?: TranscriptionOptions,
) => Promise<TranscriptResult | null>;

interface UseTranscribeWithAiArgs {
  state: AiTranscriptionState;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
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
}

function useResolvedVideo(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
): (video: DetectedVideo) => Promise<DetectedVideo | null> {
  return useCallback(
    async (video: DetectedVideo): Promise<DetectedVideo | null> => {
      const resolvedVideo = await resolvePanoptoMediaUrl(video, setState);
      if (resolvedVideo === null) return null;
      return ensureVideoHasMediaUrl(resolvedVideo, setState) ? resolvedVideo : null;
    },
    [setState],
  );
}

function useRequestStart(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  activeAiRequestIdRef: MutableRefObject<string | null>,
): (video: DetectedVideo) => string | null {
  return useCallback(
    (video: DetectedVideo): string | null => {
      return startAiTranscriptionRequest(video, setState, activeAiRequestIdRef);
    },
    [activeAiRequestIdRef, setState],
  );
}

function useRequestSuccess(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  activeAiRequestIdRef: MutableRefObject<string | null>,
  callbacks: OptionalCallbacks,
): (resolvedVideo: DetectedVideo, requestId: string, response: AiTranscriptionResponse) => void {
  return useCallback(
    (resolvedVideo: DetectedVideo, requestId: string, response: AiTranscriptionResponse): void => {
      handleAiTranscriptionSuccess({
        resolvedVideo,
        requestId,
        response,
        setState,
        activeAiRequestIdRef,
        ...(callbacks.onTranscriptReady !== undefined
          ? { onTranscriptReady: callbacks.onTranscriptReady }
          : {}),
        ...(callbacks.onExtractionResult !== undefined
          ? { onExtractionResult: callbacks.onExtractionResult }
          : {}),
      });
    },
    [activeAiRequestIdRef, callbacks.onExtractionResult, callbacks.onTranscriptReady, setState],
  );
}

function useRequestFailure(
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
  activeAiRequestIdRef: MutableRefObject<string | null>,
): (resolvedVideo: DetectedVideo, requestId: string, response: AiTranscriptionResponse) => void {
  return useCallback(
    (resolvedVideo: DetectedVideo, requestId: string, response: AiTranscriptionResponse): void => {
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
}

function useTranscribeWithAI({
  state,
  setState,
  activeAiRequestIdRef,
  resolveVideo,
  startRequest,
  handleSuccess,
  handleFailure,
}: UseTranscribeWithAiArgs): TranscribeWithAiFn {
  return useCallback(
    async (
      video: DetectedVideo,
      options?: TranscriptionOptions,
    ): Promise<TranscriptResult | null> => {
      return executeAiTranscription({
        state,
        video,
        options,
        activeAiRequestIdRef,
        resolveVideo,
        startRequest,
        handleSuccess,
        handleFailure,
        setState,
      });
    },
    [
      activeAiRequestIdRef,
      handleFailure,
      handleSuccess,
      resolveVideo,
      setState,
      startRequest,
      state,
    ],
  );
}

function useCancelAiTranscription({
  state,
  setState,
  activeAiRequestIdRef,
}: {
  state: AiTranscriptionState;
  setState: Dispatch<SetStateAction<AiTranscriptionState>>;
  activeAiRequestIdRef: MutableRefObject<string | null>;
}): () => Promise<void> {
  return useCallback(async (): Promise<void> => {
    const requestId = state.requestId;
    const jobId = state.jobId;
    const hasRequestId = requestId !== null && requestId.length > 0;
    const hasJobId = jobId !== null && jobId.length > 0;

    if (!hasRequestId && !hasJobId) {
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
}

export function useAiTranscriptionActions({
  state,
  setState,
  activeAiRequestIdRef,
  onTranscriptReady,
  onExtractionResult,
}: UseAiTranscriptionActionsArgs): UseAiTranscriptionActionsResult {
  const resolveVideo = useResolvedVideo(setState);
  const startRequest = useRequestStart(setState, activeAiRequestIdRef);
  const handleSuccess = useRequestSuccess(setState, activeAiRequestIdRef, {
    onTranscriptReady,
    onExtractionResult,
  });
  const handleFailure = useRequestFailure(setState, activeAiRequestIdRef);

  const transcribeWithAI = useTranscribeWithAI({
    state,
    setState,
    activeAiRequestIdRef,
    resolveVideo,
    startRequest,
    handleSuccess,
    handleFailure,
  });

  const cancelAiTranscription = useCancelAiTranscription({
    state,
    setState,
    activeAiRequestIdRef,
  });

  const resetAiTranscription = useCallback(() => {
    resetAiTranscriptionState(setState, activeAiRequestIdRef);
  }, [activeAiRequestIdRef, setState]);

  return {
    isBusy: isAiTranscriptionBusy(state.status),
    transcribeWithAI,
    cancelAiTranscription,
    resetAiTranscription,
  };
}
