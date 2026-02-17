import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import type { UseVideoDetectionResult } from './useVideoDetection';
import type { UseTranscriptExtractionResult } from './useTranscriptExtraction';
import type { UseAiTranscriptionResult } from './useAiTranscription';
import { isAiTranscriptionBusy } from './types';

interface UseTranscriptControlsArgs {
  detection: UseVideoDetectionResult;
  extraction: UseTranscriptExtractionResult;
  aiTranscription: UseAiTranscriptionResult;
  setIsVideoListOpen: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setAuthRequired: Dispatch<
    SetStateAction<
      | {
          provider: string;
          signInUrl: string;
        }
      | undefined
    >
  >;
}

interface UseTranscriptControlsResult {
  closeVideoList: () => void;
  detectAndAutoExtract: () => Promise<void>;
  extractTranscript: (video: DetectedVideo) => Promise<TranscriptResult | null>;
  transcribeWithAI: (
    video: DetectedVideo,
    options?: { languageHint?: string; maxMinutes?: number },
  ) => Promise<TranscriptResult | null>;
  cancelAiTranscription: () => Promise<void>;
  clearError: () => void;
}

function createExtractionFailureResult(
  result: Awaited<
    ReturnType<UseTranscriptExtractionResult['extractTranscriptWithDomFallback']>
  >['result'],
): Awaited<
  ReturnType<UseTranscriptExtractionResult['extractTranscriptWithDomFallback']>
>['result'] {
  return {
    ...result,
    error:
      result.error !== undefined && result.error.length > 0
        ? result.error
        : 'Failed to extract transcript',
  };
}

function createDetectionErrorMessage(err: unknown): string {
  return err instanceof Error && err.message.length > 0
    ? err.message
    : 'Video detection failed. Please refresh and try again.';
}

function useCloseVideoListAction(
  setIsVideoListOpen: UseTranscriptControlsArgs['setIsVideoListOpen'],
): UseTranscriptControlsResult['closeVideoList'] {
  return useCallback(() => {
    setIsVideoListOpen(false);
  }, [setIsVideoListOpen]);
}

function useAutoExtractSingleVideoAction({
  extraction,
  setIsVideoListOpen,
}: Pick<UseTranscriptControlsArgs, 'extraction' | 'setIsVideoListOpen'>): (
  video: DetectedVideo,
) => Promise<void> {
  return useCallback(
    async (video: DetectedVideo) => {
      setIsVideoListOpen(false);
      extraction.setExtracting(true, video.id);
      extraction.clearExtractionForVideo(video.id);

      try {
        const { transcript, result } = await extraction.extractTranscriptWithDomFallback(video);
        extraction.setExtracting(false);
        if (result.success && transcript !== null) {
          extraction.setLastTranscript(video, transcript);
          extraction.setExtractionResult(video.id, result);
          return;
        }
        extraction.setExtractionResult(video.id, createExtractionFailureResult(result));
        setIsVideoListOpen(true);
      } catch (extractError) {
        const errorMessage =
          extractError instanceof Error ? extractError.message : 'Failed to extract transcript';
        extraction.setExtracting(false);
        extraction.setExtractionResult(video.id, {
          success: false,
          error: errorMessage,
        });
        setIsVideoListOpen(true);
      }
    },
    [extraction, setIsVideoListOpen],
  );
}

function useDetectAndAutoExtractAction({
  autoExtractSingleVideo,
  detection,
  extraction,
  setAuthRequired,
  setError,
  setIsVideoListOpen,
}: {
  autoExtractSingleVideo: (video: DetectedVideo) => Promise<void>;
  detection: UseTranscriptControlsArgs['detection'];
  extraction: UseTranscriptControlsArgs['extraction'];
  setAuthRequired: UseTranscriptControlsArgs['setAuthRequired'];
  setError: UseTranscriptControlsArgs['setError'];
  setIsVideoListOpen: UseTranscriptControlsArgs['setIsVideoListOpen'];
}): UseTranscriptControlsResult['detectAndAutoExtract'] {
  return useCallback(async () => {
    setIsVideoListOpen(true);
    detection.setDetecting(true);
    setError(null);
    setAuthRequired(undefined);
    extraction.resetExtraction();

    try {
      const { videos } = await detection.detectVideos();
      const [singleVideo] = videos;
      if (videos.length === 1 && singleVideo !== undefined) {
        await autoExtractSingleVideo(singleVideo);
      }
    } catch (err) {
      setError(createDetectionErrorMessage(err));
    } finally {
      detection.setDetecting(false);
    }
  }, [
    autoExtractSingleVideo,
    detection,
    extraction,
    setAuthRequired,
    setError,
    setIsVideoListOpen,
  ]);
}

function useExtractTranscriptAction({
  extraction,
  aiTranscription,
  setIsVideoListOpen,
}: Pick<
  UseTranscriptControlsArgs,
  'extraction' | 'aiTranscription' | 'setIsVideoListOpen'
>): UseTranscriptControlsResult['extractTranscript'] {
  return useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      if (extraction.state.isExtracting || aiTranscription.isBusy) {
        return null;
      }
      const transcript = await extraction.extractTranscript(video);
      if (transcript !== null) {
        setIsVideoListOpen(false);
      }
      return transcript;
    },
    [aiTranscription.isBusy, extraction, setIsVideoListOpen],
  );
}

function useTranscribeWithAIAction(
  aiTranscription: UseTranscriptControlsArgs['aiTranscription'],
): UseTranscriptControlsResult['transcribeWithAI'] {
  return useCallback(
    async (
      video: DetectedVideo,
      options?: { languageHint?: string; maxMinutes?: number },
    ): Promise<TranscriptResult | null> => {
      if (isAiTranscriptionBusy(aiTranscription.state.status)) {
        return null;
      }
      return aiTranscription.transcribeWithAI(video, options);
    },
    [aiTranscription],
  );
}

function useClearErrorAction({
  detection,
  setAuthRequired,
  setError,
}: Pick<
  UseTranscriptControlsArgs,
  'detection' | 'setAuthRequired' | 'setError'
>): UseTranscriptControlsResult['clearError'] {
  return useCallback(() => {
    setError(null);
    setAuthRequired(undefined);
    detection.setError(null);
  }, [detection, setAuthRequired, setError]);
}

export function useTranscriptControls({
  detection,
  extraction,
  aiTranscription,
  setIsVideoListOpen,
  setError,
  setAuthRequired,
}: UseTranscriptControlsArgs): UseTranscriptControlsResult {
  const closeVideoList = useCloseVideoListAction(setIsVideoListOpen);
  const autoExtractSingleVideo = useAutoExtractSingleVideoAction({
    extraction,
    setIsVideoListOpen,
  });
  const detectAndAutoExtract = useDetectAndAutoExtractAction({
    autoExtractSingleVideo,
    detection,
    extraction,
    setAuthRequired,
    setError,
    setIsVideoListOpen,
  });
  const extractTranscript = useExtractTranscriptAction({
    extraction,
    aiTranscription,
    setIsVideoListOpen,
  });
  const transcribeWithAI = useTranscribeWithAIAction(aiTranscription);
  const clearError = useClearErrorAction({ detection, setAuthRequired, setError });

  return {
    closeVideoList,
    detectAndAutoExtract,
    extractTranscript,
    transcribeWithAI,
    cancelAiTranscription: aiTranscription.cancelAiTranscription,
    clearError,
  };
}
