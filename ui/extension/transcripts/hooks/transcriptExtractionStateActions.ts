import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import type { TranscriptResponseData } from './types';

interface TranscriptExtractionStateBase {
  isExtracting: boolean;
  extractingVideoId: string | null;
  extractionsByVideoId: Record<string, TranscriptResponseData>;
  lastTranscript: {
    video: DetectedVideo;
    transcript: TranscriptResult;
  } | null;
}

export interface TranscriptExtractionStateActions {
  resetExtraction: () => void;
  setExtracting: (isExtracting: boolean, videoId?: string | null) => void;
  setExtractionResult: (videoId: string, result: TranscriptResponseData) => void;
  setLastTranscript: (video: DetectedVideo, transcript: TranscriptResult) => void;
  clearExtractionForVideo: (videoId: string) => void;
}

function useResetExtraction<TState extends TranscriptExtractionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
  initialState: TState,
): TranscriptExtractionStateActions['resetExtraction'] {
  return useCallback(() => {
    setState(initialState);
  }, [initialState, setState]);
}

function useSetExtracting<TState extends TranscriptExtractionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
): TranscriptExtractionStateActions['setExtracting'] {
  return useCallback(
    (isExtracting: boolean, videoId?: string | null) => {
      setState((prev) => ({
        ...prev,
        isExtracting,
        extractingVideoId: videoId ?? null,
      }));
    },
    [setState],
  );
}

function useSetExtractionResultAction<TState extends TranscriptExtractionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
): TranscriptExtractionStateActions['setExtractionResult'] {
  return useCallback(
    (videoId: string, result: TranscriptResponseData) => {
      setState((prev) => ({
        ...prev,
        extractionsByVideoId: {
          ...prev.extractionsByVideoId,
          [videoId]: result,
        },
      }));
    },
    [setState],
  );
}

function useSetLastTranscriptAction<TState extends TranscriptExtractionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
): TranscriptExtractionStateActions['setLastTranscript'] {
  return useCallback(
    (video: DetectedVideo, transcript: TranscriptResult) => {
      setState((prev) => ({
        ...prev,
        lastTranscript: { video, transcript },
      }));
    },
    [setState],
  );
}

function useClearExtractionForVideoAction<TState extends TranscriptExtractionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
): TranscriptExtractionStateActions['clearExtractionForVideo'] {
  return useCallback(
    (videoId: string) => {
      setState((prev) => {
        const nextExtractions = { ...prev.extractionsByVideoId };
        delete nextExtractions[videoId];
        return {
          ...prev,
          extractionsByVideoId: nextExtractions,
        };
      });
    },
    [setState],
  );
}

export function useTranscriptStateActions<TState extends TranscriptExtractionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
  initialState: TState,
): TranscriptExtractionStateActions {
  const resetExtraction = useResetExtraction(setState, initialState);
  const setExtracting = useSetExtracting(setState);
  const setExtractionResult = useSetExtractionResultAction(setState);
  const setLastTranscript = useSetLastTranscriptAction(setState);
  const clearExtractionForVideo = useClearExtractionForVideoAction(setState);

  return {
    resetExtraction,
    setExtracting,
    setExtractionResult,
    setLastTranscript,
    clearExtractionForVideo,
  };
}
