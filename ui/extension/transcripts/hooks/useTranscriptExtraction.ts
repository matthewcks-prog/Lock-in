/**
 * useTranscriptExtraction Hook
 *
 * Manages transcript extraction state and logic.
 * Handles both background script extraction and DOM-based extraction for HTML5 videos.
 */

import { useState, useCallback } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import { extractHtml5TranscriptFromDom } from '../extractHtml5TranscriptFromDom';
import {
  sendToBackground,
  normalizeTranscriptResponse,
  type TranscriptResponseData,
  type BackgroundResponse,
} from './types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TranscriptExtractionState {
  /** Whether transcript extraction is in progress */
  isExtracting: boolean;
  /** ID of video currently being extracted */
  extractingVideoId: string | null;
  /** Per-video transcript extraction results */
  extractionsByVideoId: Record<string, TranscriptResponseData>;
  /** Last extracted transcript */
  lastTranscript: {
    video: DetectedVideo;
    transcript: TranscriptResult;
  } | null;
}

export interface UseTranscriptExtractionResult {
  state: TranscriptExtractionState;
  /** Extract transcript for a video */
  extractTranscript: (video: DetectedVideo) => Promise<TranscriptResult | null>;
  /** Extract transcript with DOM fallback for HTML5 videos */
  extractTranscriptWithDomFallback: (
    video: DetectedVideo,
  ) => Promise<{ transcript: TranscriptResult | null; result: TranscriptResponseData }>;
  /** Reset extraction state */
  resetExtraction: () => void;
  /** Set extracting state */
  setExtracting: (isExtracting: boolean, videoId?: string | null) => void;
  /** Update extraction result for a video */
  setExtractionResult: (videoId: string, result: TranscriptResponseData) => void;
  /** Set last transcript */
  setLastTranscript: (video: DetectedVideo, transcript: TranscriptResult) => void;
  /** Clear extraction for a video */
  clearExtractionForVideo: (videoId: string) => void;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: TranscriptExtractionState = {
  isExtracting: false,
  extractingVideoId: null,
  extractionsByVideoId: {},
  lastTranscript: null,
};

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useTranscriptExtraction(): UseTranscriptExtractionResult {
  const [state, setState] = useState<TranscriptExtractionState>(INITIAL_STATE);

  /**
   * Fetch transcript from background script
   */
  const fetchBackgroundTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResponseData> => {
      const response = await sendToBackground<BackgroundResponse>({
        type: 'EXTRACT_TRANSCRIPT',
        payload: { video },
      });

      return normalizeTranscriptResponse(response);
    },
    [],
  );

  /**
   * Extract transcript with DOM fallback for HTML5 videos
   */
  const extractTranscriptWithDomFallback = useCallback(
    async (
      video: DetectedVideo,
    ): Promise<{ transcript: TranscriptResult | null; result: TranscriptResponseData }> => {
      if (video.provider === 'html5') {
        const domResult = await extractHtml5TranscriptFromDom(video);
        // Handle null result (no video element found or no captions available)
        if (!domResult) {
          return {
            transcript: null,
            result: {
              success: false,
              error: 'No captions available for this video',
              errorCode: 'NO_CAPTIONS',
              aiTranscriptionAvailable: Boolean(video.mediaUrl),
            },
          };
        }
        if (!domResult.transcript) {
          return {
            transcript: null,
            result: {
              success: false,
              error: 'Transcript payload missing',
              errorCode: 'INVALID_RESPONSE',
              aiTranscriptionAvailable: Boolean(video.mediaUrl),
            },
          };
        }
        return {
          transcript: domResult.transcript,
          result: { success: true, transcript: domResult.transcript },
        };
      }

      const result = await fetchBackgroundTranscript(video);
      return { transcript: result.transcript || null, result };
    },
    [fetchBackgroundTranscript],
  );

  /**
   * Extract transcript for a video
   */
  const extractTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      if (state.isExtracting) {
        return null;
      }

      setState((prev) => {
        const nextExtractions = { ...prev.extractionsByVideoId };
        delete nextExtractions[video.id];
        return {
          ...prev,
          isExtracting: true,
          extractingVideoId: video.id,
          extractionsByVideoId: nextExtractions,
        };
      });

      try {
        const { transcript, result } = await extractTranscriptWithDomFallback(video);

        if (result.success && transcript) {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            lastTranscript: { video, transcript },
            extractionsByVideoId: {
              ...prev.extractionsByVideoId,
              [video.id]: result,
            },
          }));

          return transcript;
        }

        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          extractionsByVideoId: {
            ...prev.extractionsByVideoId,
            [video.id]: {
              ...result,
              error: result.error || 'Failed to extract transcript',
            },
          },
        }));

        return null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          extractionsByVideoId: {
            ...prev.extractionsByVideoId,
            [video.id]: {
              success: false,
              error: errorMessage,
            },
          },
        }));
        return null;
      }
    },
    [extractTranscriptWithDomFallback, state.isExtracting],
  );

  const resetExtraction = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const setExtracting = useCallback((isExtracting: boolean, videoId?: string | null) => {
    setState((prev) => ({
      ...prev,
      isExtracting,
      extractingVideoId: videoId ?? null,
    }));
  }, []);

  const setExtractionResult = useCallback((videoId: string, result: TranscriptResponseData) => {
    setState((prev) => ({
      ...prev,
      extractionsByVideoId: {
        ...prev.extractionsByVideoId,
        [videoId]: result,
      },
    }));
  }, []);

  const setLastTranscript = useCallback((video: DetectedVideo, transcript: TranscriptResult) => {
    setState((prev) => ({
      ...prev,
      lastTranscript: { video, transcript },
    }));
  }, []);

  const clearExtractionForVideo = useCallback((videoId: string) => {
    setState((prev) => {
      const nextExtractions = { ...prev.extractionsByVideoId };
      delete nextExtractions[videoId];
      return {
        ...prev,
        extractionsByVideoId: nextExtractions,
      };
    });
  }, []);

  return {
    state,
    extractTranscript,
    extractTranscriptWithDomFallback,
    resetExtraction,
    setExtracting,
    setExtractionResult,
    setLastTranscript,
    clearExtractionForVideo,
  };
}
