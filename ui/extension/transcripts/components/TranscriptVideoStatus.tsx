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
import type {
  AiTranscriptionUiState,
  VideoExtractionResult,
} from './types';
import { isAiTranscriptionBusy, getAiStatusLabel } from './types';

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
  // Determine AI state for this specific video
  const aiForVideo =
    aiTranscription.video && aiTranscription.video.id === video.id
      ? aiTranscription
      : null;
  const aiStatus = aiForVideo?.status ?? 'idle';
  const aiIsActive = aiForVideo ? isAiTranscriptionBusy(aiStatus) : false;
  const aiIsFailed = aiForVideo?.status === 'failed';
  const aiIsCanceled = aiForVideo?.status === 'canceled';
  const aiIsCompleted = aiForVideo?.status === 'completed';
  const aiErrorMessage = aiForVideo?.error || null;

  // Determine extraction state
  const noCaptions =
    extractionResult &&
    !extractionResult.success &&
    extractionResult.errorCode === 'NO_CAPTIONS';
  const aiAvailable = Boolean(
    noCaptions && extractionResult?.aiTranscriptionAvailable
  );
  const extractionError =
    extractionResult && !extractionResult.success && !aiAvailable
      ? extractionResult.error || 'Failed to extract transcript'
      : null;

  // Determine what to show
  const showAiProgress = aiIsActive;
  const showAiError = aiAvailable && (aiIsFailed || aiIsCanceled);
  const showAiAction = aiAvailable && !aiIsActive && !aiIsCompleted;

  // Disable logic
  const disableAiAction = isExtracting || (isAiBusy && !aiIsActive);

  // Progress display
  const progressLabel = getAiStatusLabel(aiStatus);
  const progressMessage =
    aiForVideo?.progressMessage ||
    'Working on your transcript. This can take a few minutes.';
  const progressPercent = aiForVideo?.progressPercent;
  const aiActionSubtitle =
    disableAiAction && isAiBusy && !aiIsActive
      ? 'Another AI transcription is already running.'
      : 'Generates captions when none are available.';

  return (
    <>
      {/* AI Progress */}
      {showAiProgress && (
        <div
          className="lockin-video-item-ai lockin-video-item-ai-active"
          aria-live="polite"
        >
          <div className="lockin-video-item-ai-main">
            <span className="lockin-inline-spinner" />
            <div className="lockin-video-item-ai-text">
              <div className="lockin-video-item-ai-title">{progressLabel}</div>
              <div className="lockin-video-item-ai-subtitle">
                {progressMessage}
              </div>
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
          <button
            className="lockin-video-item-ai-btn"
            onClick={onCancelAi}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}

      {/* AI Error / Canceled */}
      {showAiError && (
        <div className="lockin-video-item-ai lockin-video-item-ai-error">
          <div className="lockin-video-item-ai-text">
            <div className="lockin-video-item-ai-title">
              {aiIsCanceled
                ? 'Transcription canceled'
                : 'AI transcription failed'}
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
            <div className="lockin-video-item-ai-title">
              Transcribe with AI
            </div>
            <div className="lockin-video-item-ai-subtitle">
              {aiActionSubtitle}
            </div>
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
      {extractionError && (
        <div className="lockin-video-item-error">{extractionError}</div>
      )}
    </>
  );
}
