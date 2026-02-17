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

function AiProgressStatus({
  progressLabel,
  progressMessage,
  progressPercent,
  onCancelAi,
}: {
  progressLabel: string;
  progressMessage: string;
  progressPercent: number | null | undefined;
  onCancelAi: () => void;
}): JSX.Element {
  return (
    <div className="lockin-video-item-ai lockin-video-item-ai-active" aria-live="polite">
      <div className="lockin-video-item-ai-main">
        <span className="lockin-inline-spinner" />
        <div className="lockin-video-item-ai-text">
          <div className="lockin-video-item-ai-title">{progressLabel}</div>
          <div className="lockin-video-item-ai-subtitle">{progressMessage}</div>
        </div>
      </div>
      {typeof progressPercent === 'number' ? (
        <div className="lockin-video-item-ai-progress">
          <div
            className="lockin-video-item-ai-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      ) : null}
      <button className="lockin-video-item-ai-btn" onClick={onCancelAi} type="button">
        Cancel
      </button>
    </div>
  );
}

function AiErrorStatus({
  title,
  subtitle,
  disabled,
  onRetry,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="lockin-video-item-ai lockin-video-item-ai-error">
      <div className="lockin-video-item-ai-text">
        <div className="lockin-video-item-ai-title">{title}</div>
        <div className="lockin-video-item-ai-subtitle">{subtitle}</div>
      </div>
      <button
        className="lockin-video-item-ai-btn"
        onClick={onRetry}
        type="button"
        disabled={disabled}
      >
        Try again
      </button>
    </div>
  );
}

function AiActionStatus({
  subtitle,
  disabled,
  onTranscribe,
}: {
  subtitle: string;
  disabled: boolean;
  onTranscribe: () => void;
}): JSX.Element {
  return (
    <div className="lockin-video-item-ai">
      <div className="lockin-video-item-ai-text">
        <div className="lockin-video-item-ai-title">Transcribe with AI</div>
        <div className="lockin-video-item-ai-subtitle">{subtitle}</div>
      </div>
      <button
        className="lockin-video-item-ai-btn"
        onClick={onTranscribe}
        type="button"
        disabled={disabled}
      >
        Transcribe with AI
      </button>
    </div>
  );
}

function resolveErrorSubtitle(message: string | null | undefined): string {
  if (message !== null && message !== undefined && message.length > 0) {
    return message;
  }
  return "Try again when you're ready.";
}

export function TranscriptVideoStatus({
  video,
  extractionResult,
  aiTranscription,
  isExtracting,
  isAiBusy,
  onTranscribeWithAI,
  onCancelAi,
}: TranscriptVideoStatusProps): JSX.Element {
  const { extractionError, aiIsCanceled, ...uiState } = resolveTranscriptVideoStatusState({
    video,
    aiTranscription,
    isExtracting,
    isAiBusy,
    ...(extractionResult !== undefined ? { extractionResult } : {}),
  });

  return (
    <>
      {uiState.showAiProgress ? (
        <AiProgressStatus
          progressLabel={uiState.progressLabel}
          progressMessage={uiState.progressMessage}
          progressPercent={uiState.progressPercent}
          onCancelAi={onCancelAi}
        />
      ) : null}

      {uiState.showAiError ? (
        <AiErrorStatus
          title={aiIsCanceled ? 'Transcription canceled' : 'AI transcription failed'}
          subtitle={resolveErrorSubtitle(uiState.aiErrorMessage)}
          disabled={uiState.disableAiAction}
          onRetry={() => onTranscribeWithAI(video)}
        />
      ) : null}

      {uiState.showAiAction && !uiState.showAiError && !uiState.showAiProgress ? (
        <AiActionStatus
          subtitle={uiState.aiActionSubtitle}
          disabled={uiState.disableAiAction}
          onTranscribe={() => onTranscribeWithAI(video)}
        />
      ) : null}

      {extractionError !== null && extractionError !== undefined && extractionError.length > 0 ? (
        <div className="lockin-video-item-error">{extractionError}</div>
      ) : null}
    </>
  );
}
