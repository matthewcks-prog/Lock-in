/**
 * useTranscripts Hook
 *
 * Manages transcript extraction state and communication with background script.
 * Detects videos from multiple providers (Panopto, HTML5, Echo360).
 *
 * This is a composition hook that combines:
 * - useVideoDetection: Video detection logic
 * - useTranscriptExtraction: Transcript extraction logic
 * - useAiTranscription: AI transcription with progress polling
 */

import { useState, useCallback } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  useVideoDetection,
  useTranscriptExtraction,
  useAiTranscription,
  type AiTranscriptionState,
  type TranscriptResponseData,
  isAiTranscriptionBusy,
} from './hooks';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TranscriptState {
  /** Whether the video list panel is open */
  isVideoListOpen: boolean;
  /** Detected videos on the page */
  videos: DetectedVideo[];
  /** Whether video detection is in progress */
  isDetecting: boolean;
  /** Whether transcript extraction is in progress */
  isExtracting: boolean;
  /** ID of video currently being extracted */
  extractingVideoId: string | null;
  /** Error message for detection failures */
  error: string | null;
  /** Optional hint for empty detection results */
  detectionHint: string | null;
  /** Per-video transcript extraction results */
  extractionsByVideoId: Record<string, TranscriptResponseData>;
  /** Last extracted transcript */
  lastTranscript: {
    video: DetectedVideo;
    transcript: TranscriptResult;
  } | null;
  /** AI transcription state */
  aiTranscription: AiTranscriptionState;
  /** Auth required info for displaying sign-in prompt */
  authRequired?: {
    provider: string;
    signInUrl: string;
  };
}

interface UseTranscriptsResult {
  state: TranscriptState;
  closeVideoList: () => void;
  /** Detect videos and auto-extract if only one is found */
  detectAndAutoExtract: () => void;
  extractTranscript: (video: DetectedVideo) => Promise<TranscriptResult | null>;
  transcribeWithAI: (
    video: DetectedVideo,
    options?: { languageHint?: string; maxMinutes?: number },
  ) => Promise<TranscriptResult | null>;
  cancelAiTranscription: () => Promise<void>;
  clearError: () => void;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useTranscripts(): UseTranscriptsResult {
  // Compose the focused hooks
  const detection = useVideoDetection();
  const extraction = useTranscriptExtraction();

  // Callbacks for AI transcription to update extraction state
  const handleTranscriptReady = useCallback(
    (video: DetectedVideo, transcript: TranscriptResult) => {
      extraction.setLastTranscript(video, transcript);
      extraction.setExtracting(false);
      setIsVideoListOpen(false);
    },
    [extraction],
  );

  const handleExtractionResult = useCallback(
    (videoId: string, result: TranscriptResponseData) => {
      extraction.setExtractionResult(videoId, result);
    },
    [extraction],
  );

  const aiTranscription = useAiTranscription(handleTranscriptReady, handleExtractionResult);

  // UI state
  const [isVideoListOpen, setIsVideoListOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<
    { provider: string; signInUrl: string } | undefined
  >(undefined);

  // Compose the state
  const state: TranscriptState = {
    isVideoListOpen,
    videos: detection.state.videos,
    isDetecting: detection.state.isDetecting,
    isExtracting: extraction.state.isExtracting,
    extractingVideoId: extraction.state.extractingVideoId,
    error: error || detection.state.error,
    detectionHint: detection.state.detectionHint,
    extractionsByVideoId: extraction.state.extractionsByVideoId,
    lastTranscript: extraction.state.lastTranscript,
    aiTranscription: aiTranscription.state,
    authRequired,
  };

  const closeVideoList = useCallback(() => {
    setIsVideoListOpen(false);
  }, []);

  /**
   * Detect videos and automatically extract if only one video is found
   */
  const detectAndAutoExtract = useCallback(async () => {
    setIsVideoListOpen(true);
    detection.setDetecting(true);
    setError(null);
    setAuthRequired(undefined);

    // Reset extraction state for fresh detection
    extraction.resetExtraction();

    try {
      const { videos } = await detection.detectVideos();

      if (videos.length === 1) {
        // Single video - auto-extract without showing selection UI
        setIsVideoListOpen(false);
        extraction.setExtracting(true, videos[0].id);
        extraction.clearExtractionForVideo(videos[0].id);

        try {
          const { transcript, result } = await extraction.extractTranscriptWithDomFallback(
            videos[0],
          );

          if (result.success && transcript) {
            extraction.setExtracting(false);
            extraction.setLastTranscript(videos[0], transcript);
            extraction.setExtractionResult(videos[0].id, result);
          } else {
            extraction.setExtracting(false);
            extraction.setExtractionResult(videos[0].id, {
              ...result,
              error: result.error || 'Failed to extract transcript',
            });
            setIsVideoListOpen(true);
          }
        } catch (extractError) {
          const errorMessage =
            extractError instanceof Error ? extractError.message : 'Failed to extract transcript';
          extraction.setExtracting(false);
          extraction.setExtractionResult(videos[0].id, {
            success: false,
            error: errorMessage,
          });
          setIsVideoListOpen(true);
        }
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
  }, [detection, extraction]);

  /**
   * Extract transcript for a video
   */
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
    [extraction, aiTranscription.isBusy],
  );

  /**
   * Transcribe with AI
   */
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
  }, [detection]);

  return {
    state,
    closeVideoList,
    detectAndAutoExtract,
    extractTranscript,
    transcribeWithAI,
    cancelAiTranscription: aiTranscription.cancelAiTranscription,
    clearError,
  };
}
