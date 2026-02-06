/**
 * TranscriptVideoStatus Component
 *
 * Renders transcript-specific status and actions for a video:
 * - AI transcription progress (uploading, processing, transcribing)
 * - AI transcription errors and retry
 * - "Transcribe with AI" action button when captions unavailable
 * - Extraction errors
 */

import type { DetectedVideo } from '@core/transcripts/types';
import type { AiTranscriptionUiState, VideoExtractionResult } from './types';
import { resolveTranscriptVideoStatusState } from './TranscriptVideoStatusState';

interface TranscriptVideoStatusProps {
  video: DetectedVideo;
  extractionResult?: VideoExtractionResult;
  aiTranscription: AiTranscriptionUiState;
  isExtracting: boolean;
  isAiBusy: boolean;
  onTranscribeWithAI: (video: DetectedVideo) => void;
  onCancelAi: () => void;
}

export function TranscriptVideoStatus({
  video,
  extractionResult,
  aiTranscription,
  isExtracting,
  isAiBusy,
  onTranscribeWithAI,
  onCancelAi,
}: TranscriptVideoStatusProps) {
  const { aiAvailable, extractionError, aiIsCanceled, ...uiState } =
    resolveTranscriptVideoStatusState({
      video,
      aiTranscription,
      isExtracting,
      isAiBusy,
      ...(extractionResult ? { extractionResult } : {}),
    });
  const {
    showAiProgress,
    showAiError,
    showAiAction,
    disableAiAction,
    progressLabel,
    progressMessage,
    progressPercent,
    aiActionSubtitle,
    aiErrorMessage,
  } = uiState;

  return (
    <>
      {/* AI Progress */}
      {showAiProgress && (
        <div className="lockin-video-item-ai lockin-video-item-ai-active" aria-live="polite">
          <div className="lockin-video-item-ai-main">
            <span className="lockin-inline-spinner" />
            <div className="lockin-video-item-ai-text">
              <div className="lockin-video-item-ai-title">{progressLabel}</div>
              <div className="lockin-video-item-ai-subtitle">{progressMessage}</div>
            </div>
          </div>
          {typeof progressPercent === 'number' && (
            <div className="lockin-video-item-ai-progress">
              <div
                className="lockin-video-item-ai-progress-bar"
                style={{
                  width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                }}
              />
            </div>
          )}
          <button className="lockin-video-item-ai-btn" onClick={onCancelAi} type="button">
            Cancel
          </button>
        </div>
      )}

      {/* AI Error / Canceled */}
      {showAiError && (
        <div className="lockin-video-item-ai lockin-video-item-ai-error">
          <div className="lockin-video-item-ai-text">
            <div className="lockin-video-item-ai-title">
              {aiIsCanceled ? 'Transcription canceled' : 'AI transcription failed'}
            </div>
            <div className="lockin-video-item-ai-subtitle">
              {aiErrorMessage || "Try again when you're ready."}
            </div>
          </div>
          <button
            className="lockin-video-item-ai-btn"
            onClick={() => onTranscribeWithAI(video)}
            type="button"
            disabled={disableAiAction}
          >
            Try again
          </button>
        </div>
      )}

      {/* AI Action (initial state) */}
      {showAiAction && !showAiError && !showAiProgress && (
        <div className="lockin-video-item-ai">
          <div className="lockin-video-item-ai-text">
            <div className="lockin-video-item-ai-title">Transcribe with AI</div>
            <div className="lockin-video-item-ai-subtitle">{aiActionSubtitle}</div>
          </div>
          <button
            className="lockin-video-item-ai-btn"
            onClick={() => onTranscribeWithAI(video)}
            type="button"
            disabled={disableAiAction}
          >
            Transcribe with AI
          </button>
        </div>
      )}

      {/* Extraction Error (non-AI) */}
      {extractionError && <div className="lockin-video-item-error">{extractionError}</div>}
    </>
  );
}
