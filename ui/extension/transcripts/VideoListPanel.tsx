/**
 * VideoListPanel Component
 *
 * Displays a list of detected videos on the current page.
 * User can click a video to extract its transcript.
 */

import type { DetectedVideo } from '../../../core/transcripts/types';

interface VideoListPanelProps {
  /** List of detected videos */
  videos: DetectedVideo[];
  /** Whether video detection is in progress */
  isLoading: boolean;
  /** Whether a transcript is being extracted */
  isExtracting: boolean;
  /** ID of video currently being extracted */
  extractingVideoId: string | null;
  /** Callback when a video is selected */
  onSelectVideo: (video: DetectedVideo) => void;
  /** Callback to close the panel */
  onClose: () => void;
  /** Error message if detection failed */
  error?: string;
  /** Optional hint to show when no videos are detected */
  detectionHint?: string;
  /** Auth required info for sign-in prompt */
  authRequired?: {
    provider: string;
    signInUrl: string;
  };
  /** Per-video extraction results */
  extractionResults: Record<string, VideoExtractionResult>;
  /** AI transcription state */
  aiTranscription: AiTranscriptionUiState;
  /** Callback to start AI transcription */
  onTranscribeWithAI: (video: DetectedVideo) => void;
  /** Callback to cancel AI transcription */
  onCancelAi: () => void;
}

type AiTranscriptionStatus =
  | 'idle'
  | 'starting'
  | 'uploading'
  | 'processing'
  | 'polling'
  | 'completed'
  | 'failed'
  | 'canceled';

interface AiTranscriptionUiState {
  status: AiTranscriptionStatus;
  video: DetectedVideo | null;
  progressMessage?: string | null;
  progressPercent?: number | null;
  error?: string | null;
}

interface VideoExtractionResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  aiTranscriptionAvailable?: boolean;
}

/**
 * Provider badge component
 */
function ProviderBadge({ provider }: { provider: string }) {
  const badgeColors: Record<string, { bg: string; text: string }> = {
    panopto: { bg: '#1e3a5f', text: '#ffffff' },
    echo360: { bg: '#b45309', text: '#ffffff' },
    html5: { bg: '#2f6f44', text: '#ffffff' },
    youtube: { bg: '#cc0000', text: '#ffffff' },
    unknown: { bg: '#6b7280', text: '#ffffff' },
  };

  const colors = badgeColors[provider] || badgeColors.unknown;
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <span
      className="lockin-video-provider-badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

function isAiTranscriptionBusy(status: AiTranscriptionStatus): boolean {
  return (
    status === 'starting' ||
    status === 'uploading' ||
    status === 'processing' ||
    status === 'polling'
  );
}

function getAiStatusLabel(status: AiTranscriptionStatus): string {
  switch (status) {
    case 'starting':
      return 'Preparing AI transcription';
    case 'uploading':
      return 'Uploading media';
    case 'processing':
      return 'Processing audio';
    case 'polling':
      return 'Transcribing';
    case 'completed':
      return 'Transcript ready';
    case 'failed':
      return 'AI transcription failed';
    case 'canceled':
      return 'Transcription canceled';
    default:
      return 'AI transcription';
  }
}

/**
 * Video list item component
 */
function VideoListItem({
  video,
  isExtracting,
  extractingVideoId,
  extractionResult,
  aiTranscription,
  isAiBusy,
  onSelect,
  onTranscribeWithAI,
  onCancelAi,
}: {
  video: DetectedVideo;
  isExtracting: boolean;
  extractingVideoId: string | null;
  extractionResult?: VideoExtractionResult;
  aiTranscription: AiTranscriptionUiState;
  isAiBusy: boolean;
  onSelect: () => void;
  onTranscribeWithAI: (video: DetectedVideo) => void;
  onCancelAi: () => void;
}) {
  const isThisExtracting = isExtracting && extractingVideoId === video.id;
  const isAnotherExtracting = isExtracting && extractingVideoId !== video.id;
  const aiForVideo =
    aiTranscription.video && aiTranscription.video.id === video.id ? aiTranscription : null;
  const aiStatus = aiForVideo?.status ?? 'idle';
  const aiIsActive = aiForVideo ? isAiTranscriptionBusy(aiStatus) : false;
  const aiIsFailed = aiForVideo?.status === 'failed';
  const aiIsCanceled = aiForVideo?.status === 'canceled';
  const aiIsCompleted = aiForVideo?.status === 'completed';
  const aiErrorMessage = aiForVideo?.error || null;
  const noCaptions =
    extractionResult && !extractionResult.success && extractionResult.errorCode === 'NO_CAPTIONS';
  const aiAvailable = Boolean(noCaptions && extractionResult?.aiTranscriptionAvailable);
  const extractionError =
    extractionResult && !extractionResult.success && !aiAvailable
      ? extractionResult.error || 'Failed to extract transcript'
      : null;
  const showAiAction = aiAvailable && !aiIsActive && !aiIsCompleted;
  const showAiError = aiAvailable && (aiIsFailed || aiIsCanceled);
  const showAiProgress = aiIsActive;
  const disableExtract = isAnotherExtracting || isAiBusy;
  const disableAiAction = isExtracting || (isAiBusy && !aiIsActive);
  const progressLabel = getAiStatusLabel(aiStatus);
  const progressMessage =
    aiForVideo?.progressMessage || 'Working on your transcript. This can take a few minutes.';
  const progressPercent = aiForVideo?.progressPercent;
  const aiActionSubtitle =
    disableAiAction && isAiBusy && !aiIsActive
      ? 'Another AI transcription is already running.'
      : 'Generates captions when none are available.';

  return (
    <div className={`lockin-video-item ${isThisExtracting ? 'is-extracting' : ''}`} role="listitem">
      <button
        className="lockin-video-item-main"
        onClick={onSelect}
        disabled={disableExtract}
        type="button"
      >
        <div className="lockin-video-item-content">
          <div className="lockin-video-item-header">
            <ProviderBadge provider={video.provider} />
            <span className="lockin-video-item-title">{video.title}</span>
            {noCaptions && <span className="lockin-video-item-badge">No transcript</span>}
          </div>
        </div>
        <div className="lockin-video-item-action">
          {isThisExtracting ? (
            <span className="lockin-inline-spinner" />
          ) : (
            <span className="lockin-video-extract-icon">→</span>
          )}
        </div>
      </button>

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

      {extractionError && <div className="lockin-video-item-error">{extractionError}</div>}
    </div>
  );
}

/**
 * Auth required prompt component
 */
function AuthRequiredPrompt({ provider, signInUrl }: { provider: string; signInUrl: string }) {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  const handleSignIn = () => {
    window.open(signInUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="lockin-video-auth-required">
      <p className="lockin-video-auth-message">
        Please sign in to {providerName} to view recordings.
      </p>
      <button className="lockin-video-auth-button" onClick={handleSignIn} type="button">
        Open {providerName} Sign In
      </button>
      <p className="lockin-video-auth-hint">After signing in, close this panel and try again.</p>
    </div>
  );
}

export function VideoListPanel({
  videos,
  isLoading,
  isExtracting,
  extractingVideoId,
  onSelectVideo,
  onClose,
  error,
  detectionHint,
  authRequired,
  extractionResults,
  aiTranscription,
  onTranscribeWithAI,
  onCancelAi,
}: VideoListPanelProps) {
  const isAiBusy = isAiTranscriptionBusy(aiTranscription.status);
  const showError = Boolean(error) && videos.length === 0;

  return (
    <div className="lockin-video-list-panel">
      <div className="lockin-video-list-header">
        <h3 className="lockin-video-list-title">Select a video</h3>
        <button
          className="lockin-video-list-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="lockin-video-list-body">
        {isLoading ? (
          <div className="lockin-video-list-loading">
            <span className="lockin-inline-spinner" />
            <span>Detecting videos...</span>
          </div>
        ) : authRequired ? (
          <AuthRequiredPrompt provider={authRequired.provider} signInUrl={authRequired.signInUrl} />
        ) : showError ? (
          <div className="lockin-video-list-error">
            <p>{error}</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="lockin-video-list-empty">
            <p>No videos detected on this page.</p>
            <p className="lockin-video-list-hint">Supported: Panopto, Echo360, HTML5 videos</p>
            {detectionHint && <p className="lockin-video-list-hint">{detectionHint}</p>}
          </div>
        ) : (
          <div className="lockin-video-list" role="list">
            {videos.map((video) => (
              <VideoListItem
                key={`${video.provider}-${video.id}`}
                video={video}
                isExtracting={isExtracting}
                extractingVideoId={extractingVideoId}
                extractionResult={extractionResults[video.id]}
                aiTranscription={aiTranscription}
                isAiBusy={isAiBusy}
                onSelect={() => {
                  onSelectVideo(video);
                }}
                onTranscribeWithAI={onTranscribeWithAI}
                onCancelAi={onCancelAi}
              />
            ))}
          </div>
        )}
      </div>

      <div className="lockin-video-list-footer">
        <p className="lockin-video-list-info">
          {videos.length} video{videos.length !== 1 ? 's' : ''} found
        </p>
      </div>
    </div>
  );
}
