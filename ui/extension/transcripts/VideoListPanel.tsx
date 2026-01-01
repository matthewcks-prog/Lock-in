/**
 * VideoListPanel Component
 *
 * Displays a list of detected videos on the current page.
 * User can click a video to extract its transcript.
 */

import type { DetectedVideo } from "../../../core/transcripts/types";

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
  /** Auth required info for sign-in prompt */
  authRequired?: {
    provider: string;
    signInUrl: string;
  };
  /** AI transcription fallback state */
  aiFallback?: {
    video: DetectedVideo | null;
    isAvailable: boolean;
    isTranscribing: boolean;
    progressMessage?: string | null;
    error?: string | null;
    onTranscribe: (video: DetectedVideo) => void;
    onCancel: () => void;
  };
}

/**
 * Provider badge component
 */
function ProviderBadge({ provider }: { provider: string }) {
  const badgeColors: Record<string, { bg: string; text: string }> = {
    panopto: { bg: "#1e3a5f", text: "#ffffff" },
    echo360: { bg: "#4a1d96", text: "#ffffff" },
    youtube: { bg: "#cc0000", text: "#ffffff" },
    unknown: { bg: "#6b7280", text: "#ffffff" },
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

/**
 * Format date for display
 */
function formatRecordingDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * Format duration for display
 */
function formatDuration(durationMs: number | undefined): string | null {
  if (!durationMs) return null;
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Video list item component
 */
function VideoListItem({
  video,
  isExtracting,
  onSelect,
}: {
  video: DetectedVideo;
  isExtracting: boolean;
  onSelect: () => void;
}) {
  const recordingDate = formatRecordingDate(video.recordedAt);
  const duration = formatDuration(video.durationMs);

  return (
    <button
      className={`lockin-video-item ${isExtracting ? "is-extracting" : ""}`}
      onClick={onSelect}
      disabled={isExtracting}
      type="button"
    >
      <div className="lockin-video-item-content">
        <div className="lockin-video-item-header">
          <ProviderBadge provider={video.provider} />
          <span className="lockin-video-item-title">{video.title}</span>
        </div>
        {(recordingDate || duration) && (
          <div className="lockin-video-item-meta">
            {recordingDate && (
              <span className="lockin-video-item-date">{recordingDate}</span>
            )}
            {duration && (
              <span className="lockin-video-item-duration">{duration}</span>
            )}
          </div>
        )}
      </div>
      <div className="lockin-video-item-action">
        {isExtracting ? (
          <span className="lockin-inline-spinner" />
        ) : (
          <span className="lockin-video-extract-icon">→</span>
        )}
      </div>
    </button>
  );
}

/**
 * Auth required prompt component
 */
function AuthRequiredPrompt({
  provider,
  signInUrl,
}: {
  provider: string;
  signInUrl: string;
}) {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  const handleSignIn = () => {
    window.open(signInUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="lockin-video-auth-required">
      <p className="lockin-video-auth-message">
        Please sign in to {providerName} to view recordings.
      </p>
      <button
        className="lockin-video-auth-button"
        onClick={handleSignIn}
        type="button"
      >
        Open {providerName} Sign In
      </button>
      <p className="lockin-video-auth-hint">
        After signing in, close this panel and try again.
      </p>
    </div>
  );
}

function AiFallbackBanner({
  video,
  isTranscribing,
  progressMessage,
  error,
  onTranscribe,
  onCancel,
}: {
  video: DetectedVideo | null;
  isTranscribing: boolean;
  progressMessage?: string | null;
  error?: string | null;
  onTranscribe: (video: DetectedVideo) => void;
  onCancel: () => void;
}) {
  const title = video?.title ? ` for "${video.title}"` : "";
  const message = error
    ? `AI transcription failed: ${error}`
    : progressMessage ||
      (isTranscribing
        ? "Transcribing with AI..."
        : `No captions found${title}. You can transcribe with AI.`);

  return (
    <div className="lockin-transcript-ai-fallback">
      {isTranscribing && <span className="lockin-inline-spinner" />}
      <span className="lockin-transcript-ai-fallback-text">{message}</span>
      {isTranscribing ? (
        <button
          className="lockin-transcript-ai-fallback-btn"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      ) : (
        <button
          className="lockin-transcript-ai-fallback-btn"
          onClick={() => video && onTranscribe(video)}
          type="button"
          disabled={!video}
        >
          Transcribe with AI
        </button>
      )}
    </div>
  );
}

export function VideoListPanel({
  videos,
  isLoading,
  isExtracting: _isExtracting,
  extractingVideoId,
  onSelectVideo,
  onClose,
  error,
  authRequired,
  aiFallback,
}: VideoListPanelProps) {
  // Note: isExtracting is used for global loading state, extractingVideoId for per-video state
  void _isExtracting; // Mark as intentionally unused (parent uses extractingVideoId)
  const showAiFallback =
    aiFallback &&
    (aiFallback.isAvailable || aiFallback.isTranscribing || aiFallback.error);
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
          <AuthRequiredPrompt
            provider={authRequired.provider}
            signInUrl={authRequired.signInUrl}
          />
        ) : error ? (
          <div className="lockin-video-list-error">
            <p>{error}</p>
            {showAiFallback && aiFallback ? (
              <AiFallbackBanner
                video={aiFallback.video}
                isTranscribing={aiFallback.isTranscribing}
                progressMessage={aiFallback.progressMessage}
                error={aiFallback.error}
                onTranscribe={aiFallback.onTranscribe}
                onCancel={aiFallback.onCancel}
              />
            ) : null}
          </div>
        ) : videos.length === 0 ? (
          <div className="lockin-video-list-empty">
            <p>No videos detected on this page.</p>
            <p className="lockin-video-list-hint">
              Supported: Panopto embeds, Echo360 recordings
            </p>
          </div>
        ) : (
          <div className="lockin-video-list">
            {videos.map((video) => (
              <VideoListItem
                key={`${video.provider}-${video.id}`}
                video={video}
                isExtracting={extractingVideoId === video.id}
                onSelect={() => onSelectVideo(video)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="lockin-video-list-footer">
        <p className="lockin-video-list-info">
          {videos.length} video{videos.length !== 1 ? "s" : ""} found
        </p>
      </div>
    </div>
  );
}
