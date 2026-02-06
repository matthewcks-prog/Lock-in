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

export function useTranscriptControls({
  detection,
  extraction,
  aiTranscription,
  setIsVideoListOpen,
  setError,
  setAuthRequired,
}: UseTranscriptControlsArgs) {
  const closeVideoList = useCallback(() => {
    setIsVideoListOpen(false);
  }, [setIsVideoListOpen]);

  const autoExtractSingleVideo = useCallback(
    async (video: DetectedVideo) => {
      setIsVideoListOpen(false);
      extraction.setExtracting(true, video.id);
      extraction.clearExtractionForVideo(video.id);

      try {
        const { transcript, result } = await extraction.extractTranscriptWithDomFallback(video);

        if (result.success && transcript) {
          extraction.setExtracting(false);
          extraction.setLastTranscript(video, transcript);
          extraction.setExtractionResult(video.id, result);
        } else {
          extraction.setExtracting(false);
          extraction.setExtractionResult(video.id, {
            ...result,
            error: result.error || 'Failed to extract transcript',
          });
          setIsVideoListOpen(true);
        }
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

  const detectAndAutoExtract = useCallback(async () => {
    setIsVideoListOpen(true);
    detection.setDetecting(true);
    setError(null);
    setAuthRequired(undefined);

    extraction.resetExtraction();

    try {
      const { videos } = await detection.detectVideos();
      const [singleVideo] = videos;

      if (videos.length === 1 && singleVideo) {
        await autoExtractSingleVideo(singleVideo);
      }

      detection.setDetecting(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Video detection failed. Please refresh and try again.';
      setError(message);
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

  const extractTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      if (extraction.state.isExtracting || aiTranscription.isBusy) {
        return null;
      }

      const transcript = await extraction.extractTranscript(video);

      if (transcript) {
        setIsVideoListOpen(false);
      }

      return transcript;
    },
    [aiTranscription.isBusy, extraction, setIsVideoListOpen],
  );

  const transcribeWithAI = useCallback(
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

  const clearError = useCallback(() => {
    setError(null);
    setAuthRequired(undefined);
    detection.setError(null);
  }, [detection, setAuthRequired, setError]);

  return {
    closeVideoList,
    detectAndAutoExtract,
    extractTranscript,
    transcribeWithAI,
    cancelAiTranscription: aiTranscription.cancelAiTranscription,
    clearError,
  };
}
