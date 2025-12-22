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
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="lockin-video-thumbnail"
          />
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

export function VideoListPanel({
  videos,
  isLoading,
  isExtracting: _isExtracting,
  extractingVideoId,
  onSelectVideo,
  onClose,
  error,
}: VideoListPanelProps) {
  // Note: isExtracting is used for global loading state, extractingVideoId for per-video state
  void _isExtracting; // Mark as intentionally unused (parent uses extractingVideoId)
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
        ) : error ? (
          <div className="lockin-video-list-error">
            <p>{error}</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="lockin-video-list-empty">
            <p>No videos detected on this page.</p>
            <p className="lockin-video-list-hint">
              Supported: Panopto embeds
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

