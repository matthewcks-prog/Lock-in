/**
 * VideoListPanel Component
 *
 * Generic panel for displaying and selecting videos.
 * Handles loading, empty, error, and auth-required states.
 *
 * Feature-specific code (Transcript, Key Takeaways, etc.) can:
 * - Customize title, empty message, supported providers text
 * - Inject custom badges/actions via render props
 * - Control selection state and disabled logic
 */

import type { DetectedVideo } from '@core/transcripts/types';
import { VideoListItem } from './VideoListItem';
import type {
  VideoItemBadgeRenderer,
  VideoItemActionRenderer,
  VideoItemStatusRenderer,
} from './types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface VideoListPanelProps {
  /** List of detected videos */
  videos: DetectedVideo[];
  /** Whether video detection is in progress */
  isLoading: boolean;
  /** Callback when a video is selected */
  onSelectVideo: (video: DetectedVideo) => void;
  /** Callback to close the panel */
  onClose: () => void;

  // State props
  /** Error message if detection failed */
  error?: string;
  /** Optional hint to show when no videos are detected */
  detectionHint?: string;
  /** Auth required info for sign-in prompt */
  authRequired?: {
    provider: string;
    signInUrl: string;
  };

  // Selection state
  /** ID of the currently selected video */
  selectedVideoId?: string | null;
  /** Function to determine if a video should be disabled */
  isVideoDisabled?: (video: DetectedVideo) => boolean;

  // Customization
  /** Panel title (default: "Select a video") */
  title?: string;
  /** Message shown when no videos detected */
  emptyMessage?: string;
  /** Supported providers hint text */
  supportedProviders?: string;

  // Render props for item customization
  /** Custom badge renderer for each video item */
  renderItemBadge?: VideoItemBadgeRenderer;
  /** Custom actions renderer for each video item */
  renderItemActions?: VideoItemActionRenderer;
  /** Custom status renderer for each video item */
  renderItemStatus?: VideoItemStatusRenderer;
}

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------

/**
 * Auth required prompt for providers needing sign-in
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

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function VideoListPanel({
  videos,
  isLoading,
  onSelectVideo,
  onClose,
  error,
  detectionHint,
  authRequired,
  selectedVideoId,
  isVideoDisabled,
  title = 'Select a video',
  emptyMessage = 'No videos detected on this page.',
  supportedProviders = 'Supported: Panopto, Echo360, HTML5 videos',
  renderItemBadge,
  renderItemActions,
  renderItemStatus,
}: VideoListPanelProps) {
  const showError = Boolean(error) && videos.length === 0;

  return (
    <div className="lockin-video-list-panel">
      <div className="lockin-video-list-header">
        <h3 className="lockin-video-list-title">{title}</h3>
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
            <p>{emptyMessage}</p>
            <p className="lockin-video-list-hint">{supportedProviders}</p>
            {detectionHint && <p className="lockin-video-list-hint">{detectionHint}</p>}
          </div>
        ) : (
          <div className="lockin-video-list" role="list">
            {videos.map((video) => {
              const isSelected = selectedVideoId === video.id;
              const isDisabled = isVideoDisabled?.(video) ?? false;

              return (
                <VideoListItem
                  key={`${video.provider}-${video.id}`}
                  video={video}
                  onSelect={() => onSelectVideo(video)}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  renderBadge={renderItemBadge}
                  renderActions={renderItemActions}
                  renderStatus={renderItemStatus}
                />
              );
            })}
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
