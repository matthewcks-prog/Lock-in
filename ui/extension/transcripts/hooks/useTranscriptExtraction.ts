/**
 * useTranscriptExtraction Hook
 *
 * Manages transcript extraction state and logic.
 * Handles both background script extraction and DOM-based extraction for HTML5 videos.
 */

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import { extractHtml5TranscriptFromDom } from '../extractHtml5TranscriptFromDom';
import {
  sendToBackground,
  normalizeTranscriptResponse,
  type TranscriptResponseData,
  type BackgroundResponse,
} from './types';
import { useTranscriptStateActions } from './transcriptExtractionStateActions';

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

type TranscriptStateSetter = Dispatch<SetStateAction<TranscriptExtractionState>>;

function createNoCaptionsResult(video: DetectedVideo): {
  transcript: null;
  result: TranscriptResponseData;
} {
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

function createMissingTranscriptResult(video: DetectedVideo): {
  transcript: null;
  result: TranscriptResponseData;
} {
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

async function extractFromHtml5Dom(video: DetectedVideo): Promise<{
  transcript: TranscriptResult | null;
  result: TranscriptResponseData;
}> {
  const domResult = await extractHtml5TranscriptFromDom(video);
  if (domResult === null) {
    return createNoCaptionsResult(video);
  }
  if (domResult.transcript === undefined) {
    return createMissingTranscriptResult(video);
  }
  return {
    transcript: domResult.transcript,
    result: { success: true, transcript: domResult.transcript },
  };
}

function useBackgroundTranscriptFetcher(): (
  video: DetectedVideo,
) => Promise<TranscriptResponseData> {
  return useCallback(async (video: DetectedVideo): Promise<TranscriptResponseData> => {
    const response = await sendToBackground<BackgroundResponse>({
      type: 'EXTRACT_TRANSCRIPT',
      payload: { video },
    });
    return normalizeTranscriptResponse(response);
  }, []);
}

function useTranscriptDomFallbackExtractor(
  fetchBackgroundTranscript: (video: DetectedVideo) => Promise<TranscriptResponseData>,
): UseTranscriptExtractionResult['extractTranscriptWithDomFallback'] {
  return useCallback(
    async (video: DetectedVideo) => {
      if (video.provider === 'html5') {
        return extractFromHtml5Dom(video);
      }
      const result = await fetchBackgroundTranscript(video);
      return { transcript: result.transcript ?? null, result };
    },
    [fetchBackgroundTranscript],
  );
}

function beginExtraction(setState: TranscriptStateSetter, videoId: string): void {
  setState((prev) => {
    const nextExtractions = { ...prev.extractionsByVideoId };
    delete nextExtractions[videoId];
    return {
      ...prev,
      isExtracting: true,
      extractingVideoId: videoId,
      extractionsByVideoId: nextExtractions,
    };
  });
}

function completeExtractionSuccess(
  setState: TranscriptStateSetter,
  video: DetectedVideo,
  transcript: TranscriptResult,
  result: TranscriptResponseData,
): void {
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
}

function completeExtractionFailure(
  setState: TranscriptStateSetter,
  videoId: string,
  result: TranscriptResponseData,
): void {
  setState((prev) => ({
    ...prev,
    isExtracting: false,
    extractingVideoId: null,
    extractionsByVideoId: {
      ...prev.extractionsByVideoId,
      [videoId]: {
        ...result,
        error: result.error ?? 'Failed to extract transcript',
      },
    },
  }));
}

function completeExtractionError(
  setState: TranscriptStateSetter,
  videoId: string,
  error: unknown,
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  setState((prev) => ({
    ...prev,
    isExtracting: false,
    extractingVideoId: null,
    extractionsByVideoId: {
      ...prev.extractionsByVideoId,
      [videoId]: {
        success: false,
        error: errorMessage,
      },
    },
  }));
}

async function runExtraction({
  video,
  isExtracting,
  extractTranscriptWithDomFallback,
  setState,
}: {
  video: DetectedVideo;
  isExtracting: boolean;
  extractTranscriptWithDomFallback: UseTranscriptExtractionResult['extractTranscriptWithDomFallback'];
  setState: TranscriptStateSetter;
}): Promise<TranscriptResult | null> {
  if (isExtracting) {
    return null;
  }

  beginExtraction(setState, video.id);

  try {
    const { transcript, result } = await extractTranscriptWithDomFallback(video);
    if (result.success && transcript !== null) {
      completeExtractionSuccess(setState, video, transcript, result);
      return transcript;
    }
    completeExtractionFailure(setState, video.id, result);
    return null;
  } catch (error) {
    completeExtractionError(setState, video.id, error);
    return null;
  }
}

function useExtractTranscriptAction({
  isExtracting,
  setState,
  extractTranscriptWithDomFallback,
}: {
  isExtracting: boolean;
  setState: TranscriptStateSetter;
  extractTranscriptWithDomFallback: UseTranscriptExtractionResult['extractTranscriptWithDomFallback'];
}): UseTranscriptExtractionResult['extractTranscript'] {
  return useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> =>
      runExtraction({
        video,
        isExtracting,
        extractTranscriptWithDomFallback,
        setState,
      }),
    [extractTranscriptWithDomFallback, isExtracting, setState],
  );
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useTranscriptExtraction(): UseTranscriptExtractionResult {
  const [state, setState] = useState<TranscriptExtractionState>(INITIAL_STATE);
  const fetchBackgroundTranscript = useBackgroundTranscriptFetcher();
  const extractTranscriptWithDomFallback =
    useTranscriptDomFallbackExtractor(fetchBackgroundTranscript);
  const extractTranscript = useExtractTranscriptAction({
    isExtracting: state.isExtracting,
    setState,
    extractTranscriptWithDomFallback,
  });
  const actions = useTranscriptStateActions(setState, INITIAL_STATE);

  return {
    state,
    extractTranscript,
    extractTranscriptWithDomFallback,
    ...actions,
  };
}
