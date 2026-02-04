/**
 * useAiTranscription Hook
 *
 * Manages AI transcription state, progress polling, and cancellation.
 * Handles communication with background script for AI-powered transcription.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  sendToBackground,
  mapStageToStatus,
  isAiTranscriptionBusy,
  formatAiProgressMessage,
  formatDurationForConfirm,
  LONG_DURATION_CONFIRM_MS,
  INITIAL_AI_TRANSCRIPTION_STATE,
  type AiTranscriptionState,
  type AiTranscriptionResponse,
  type AiTranscriptionProgressPayload,
  type PanoptoMediaUrlResponse,
  type TranscriptResponseData,
} from './types';

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

async function resolvePanoptoMediaUrl(
  video: DetectedVideo,
  setState: React.Dispatch<React.SetStateAction<AiTranscriptionState>>,
): Promise<DetectedVideo | null> {
  if (video.provider !== 'panopto' || video.mediaUrl) {
    return video;
  }

  setState({
    status: 'starting',
    requestId: null,
    jobId: null,
    video,
    progressMessage: 'Finding downloadable video URL... (checking if podcast download is enabled)',
    progressPercent: null,
    error: null,
  });

  try {
    const mediaUrlResponse = await sendToBackground<PanoptoMediaUrlResponse>({
      type: 'FETCH_PANOPTO_MEDIA_URL',
      payload: { video },
    });

    if (!mediaUrlResponse.success || !mediaUrlResponse.mediaUrl) {
      const errorMsg =
        mediaUrlResponse.error ||
        'Could not find video URL. The video may be restricted or require authentication.';
      setState({
        status: 'failed',
        requestId: null,
        jobId: null,
        video,
        progressMessage: null,
        progressPercent: null,
        error: errorMsg,
      });
      return null;
    }

    return { ...video, mediaUrl: mediaUrlResponse.mediaUrl };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Failed to prepare video for AI transcription';
    setState({
      status: 'failed',
      requestId: null,
      jobId: null,
      video,
      progressMessage: null,
      progressPercent: null,
      error: errorMsg,
    });
    return null;
  }
}

function ensureVideoHasMediaUrl(
  video: DetectedVideo,
  setState: React.Dispatch<React.SetStateAction<AiTranscriptionState>>,
) {
  if (video.mediaUrl) return true;
  setState({
    status: 'failed',
    requestId: null,
    jobId: null,
    video,
    progressMessage: null,
    progressPercent: null,
    error: 'AI transcription is not available for this video.',
  });
  return false;
}

function buildConfirmMessage(video: DetectedVideo): string {
  const durationLabel = formatDurationForConfirm(video.durationMs);
  const isLong =
    typeof video.durationMs === 'number' && video.durationMs >= LONG_DURATION_CONFIRM_MS;

  return isLong
    ? `This ${durationLabel ? `${durationLabel} ` : ''}video will be uploaded to Lock-in for AI transcription. This may take several minutes. Continue?`
    : 'This video will be uploaded to Lock-in for AI transcription. Continue?';
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

  // Listen for progress updates from background script
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return;
    }

    const listener = (
      message: { type?: string; payload?: AiTranscriptionProgressPayload },
      _sender: chrome.runtime.MessageSender,
    ) => {
      if (!message || message.type !== 'TRANSCRIBE_MEDIA_AI_PROGRESS') return;
      const payload = message.payload || {};
      if (!payload.requestId || payload.requestId !== activeAiRequestIdRef.current) {
        return;
      }

      setState((prev) => {
        if (prev.requestId !== payload.requestId) return prev;
        const nextStatus = mapStageToStatus(payload.stage, prev.status);
        const progressMessage = formatAiProgressMessage(
          payload.stage,
          payload.message,
          payload.percent,
          prev.progressMessage,
        );
        return {
          ...prev,
          status: nextStatus,
          progressMessage,
          progressPercent:
            typeof payload.percent === 'number' ? payload.percent : prev.progressPercent,
        };
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const isBusy = isAiTranscriptionBusy(state.status);

  const transcribeWithAI = useCallback(
    async (
      video: DetectedVideo,
      options?: { languageHint?: string; maxMinutes?: number },
    ): Promise<TranscriptResult | null> => {
      if (isAiTranscriptionBusy(state.status)) return null;

      const resolvedVideo = await resolvePanoptoMediaUrl(video, setState);
      if (!resolvedVideo) return null;

      if (!ensureVideoHasMediaUrl(resolvedVideo, setState)) {
        return null;
      }

      // Ethical consent: Explain external processing clearly
      const confirmMessage = buildConfirmMessage(resolvedVideo);
      if (!window.confirm(confirmMessage)) return null;

      const requestId = `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeAiRequestIdRef.current = requestId;

      setState({
        status: 'starting',
        requestId,
        jobId: null,
        video: resolvedVideo,
        progressMessage:
          'No transcript available - transcribing with AI... This may take a minute.',
        progressPercent: null,
        error: null,
      });

      try {
        const response = await sendToBackground<AiTranscriptionResponse>({
          type: 'TRANSCRIBE_MEDIA_AI',
          payload: { video: resolvedVideo, options, requestId },
        });

        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }

        if (response.success && response.transcript) {
          const transcript = response.transcript;

          setState({
            status: 'completed',
            requestId,
            jobId: response.jobId || null,
            video: resolvedVideo,
            progressMessage: 'Transcript ready',
            progressPercent: 100,
            error: null,
          });

          // Notify callbacks
          onTranscriptReady?.(resolvedVideo, transcript);
          onExtractionResult?.(resolvedVideo.id, { success: true, transcript });

          activeAiRequestIdRef.current = null;
          return transcript;
        }

        const errorMessage = response.error || 'AI transcription failed';
        const fallbackStatus = response.status === 'canceled' ? 'canceled' : 'failed';
        const nextStatus = mapStageToStatus(response.status, fallbackStatus);

        setState((prev) => ({
          status: nextStatus,
          requestId,
          jobId: response.jobId || prev.jobId,
          video: resolvedVideo,
          progressMessage: null,
          progressPercent: null,
          error: errorMessage,
        }));

        activeAiRequestIdRef.current = null;
        return null;
      } catch (error) {
        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }
        const message = error instanceof Error ? error.message : 'AI transcription failed';
        setState((prev) => ({
          status: 'failed',
          requestId,
          jobId: prev.jobId,
          video: resolvedVideo,
          progressMessage: null,
          progressPercent: null,
          error: message,
        }));
        activeAiRequestIdRef.current = null;
        return null;
      }
    },
    [state.status, onTranscriptReady, onExtractionResult],
  );

  const cancelAiTranscription = useCallback(async (): Promise<void> => {
    const requestId = state.requestId;
    const jobId = state.jobId;
    if (!requestId && !jobId) {
      return;
    }

    activeAiRequestIdRef.current = null;
    setState((prev) => ({
      ...prev,
      status: 'canceled',
      progressMessage: 'Transcription canceled',
      progressPercent: null,
      error: null,
    }));

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
  }, [state.jobId, state.requestId]);

  const resetAiTranscription = useCallback(() => {
    activeAiRequestIdRef.current = null;
    setState(INITIAL_AI_TRANSCRIPTION_STATE);
  }, []);

  return {
    state,
    isBusy,
    transcribeWithAI,
    cancelAiTranscription,
    resetAiTranscription,
  };
}
