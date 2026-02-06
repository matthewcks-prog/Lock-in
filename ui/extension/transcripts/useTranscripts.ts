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
} from './hooks';
import { useTranscriptControls } from './hooks/useTranscriptControls';

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

  const controls = useTranscriptControls({
    detection,
    extraction,
    aiTranscription,
    setIsVideoListOpen,
    setError,
    setAuthRequired,
  });

  // Compose the state
  const stateBase: TranscriptState = {
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
  };
  const state: TranscriptState = authRequired ? { ...stateBase, authRequired } : stateBase;

  return {
    state,
    ...controls,
  };
}
