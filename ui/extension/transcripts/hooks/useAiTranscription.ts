/**
 * useAiTranscription Hook
 *
 * Manages AI transcription state, progress polling, and cancellation.
 * Handles communication with background script for AI-powered transcription.
 */

import { useState, useRef } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  INITIAL_AI_TRANSCRIPTION_STATE,
  type AiTranscriptionState,
  type TranscriptResponseData,
} from './types';
import { useAiTranscriptionActions } from './useAiTranscriptionActions';
import { useAiTranscriptionProgressListener } from './useAiTranscriptionProgressListener';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UseAiTranscriptionResult {
  state: AiTranscriptionState;
  /** Check if AI transcription is currently busy */
  isBusy: boolean;
  /** Start AI transcription for a video */
  transcribeWithAI: (
    video: DetectedVideo,
    options?: { languageHint?: string; maxMinutes?: number },
  ) => Promise<TranscriptResult | null>;
  /** Cancel ongoing AI transcription */
  cancelAiTranscription: () => Promise<void>;
  /** Reset AI transcription state */
  resetAiTranscription: () => void;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useAiTranscription(
  /** Callback when transcription completes successfully */
  onTranscriptReady?: (video: DetectedVideo, transcript: TranscriptResult) => void,
  /** Callback to update extraction state */
  onExtractionResult?: (videoId: string, result: TranscriptResponseData) => void,
): UseAiTranscriptionResult {
  const [state, setState] = useState<AiTranscriptionState>(INITIAL_AI_TRANSCRIPTION_STATE);
  const activeAiRequestIdRef = useRef<string | null>(null);

  useAiTranscriptionProgressListener(activeAiRequestIdRef, setState);
  const actions = useAiTranscriptionActions({
    state,
    setState,
    activeAiRequestIdRef,
    ...(onTranscriptReady ? { onTranscriptReady } : {}),
    ...(onExtractionResult ? { onExtractionResult } : {}),
  });

  return {
    state,
    ...actions,
  };
}
