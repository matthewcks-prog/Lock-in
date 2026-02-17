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
import type { VideoListItemProps } from './VideoListItem';
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
function AuthRequiredPrompt({
  provider,
  signInUrl,
}: {
  provider: string;
  signInUrl: string;
}): JSX.Element {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  const handleSignIn = (): void => {
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

function VideoListHeader({ title, onClose }: { title: string; onClose: () => void }): JSX.Element {
  return (
    <div className="lockin-video-list-header">
      <h3 className="lockin-video-list-title">{title}</h3>
      <button
        className="lockin-video-list-close"
        onClick={onClose}
        aria-label="Close"
        type="button"
      >
        \u00D7
      </button>
    </div>
  );
}

function VideoListFooter({ count }: { count: number }): JSX.Element {
  return (
    <div className="lockin-video-list-footer">
      <p className="lockin-video-list-info">
        {count} video{count !== 1 ? 's' : ''} found
      </p>
    </div>
  );
}

function buildVideoListItemProps({
  video,
  onSelectVideo,
  selectedVideoId,
  isVideoDisabled,
  renderItemBadge,
  renderItemActions,
  renderItemStatus,
}: {
  video: DetectedVideo;
  onSelectVideo: (video: DetectedVideo) => void;
  selectedVideoId: string | null | undefined;
  isVideoDisabled: ((video: DetectedVideo) => boolean) | undefined;
  renderItemBadge: VideoItemBadgeRenderer | undefined;
  renderItemActions: VideoItemActionRenderer | undefined;
  renderItemStatus: VideoItemStatusRenderer | undefined;
}): VideoListItemProps {
  const itemProps: VideoListItemProps = {
    video,
    onSelect: () => onSelectVideo(video),
    isSelected: selectedVideoId === video.id,
    isDisabled: isVideoDisabled?.(video) ?? false,
  };

  if (renderItemBadge !== undefined) {
    itemProps.renderBadge = renderItemBadge;
  }
  if (renderItemActions !== undefined) {
    itemProps.renderActions = renderItemActions;
  }
  if (renderItemStatus !== undefined) {
    itemProps.renderStatus = renderItemStatus;
  }

  return itemProps;
}

function VideoListLoadingState(): JSX.Element {
  return (
    <div className="lockin-video-list-loading">
      <span className="lockin-inline-spinner" />
      <span>Detecting videos...</span>
    </div>
  );
}

function VideoListErrorState({ error }: { error: string | undefined }): JSX.Element {
  return (
    <div className="lockin-video-list-error">
      <p>{error}</p>
    </div>
  );
}

function VideoListEmptyState({
  emptyMessage,
  supportedProviders,
  detectionHint,
}: {
  emptyMessage: string;
  supportedProviders: string;
  detectionHint: string | undefined;
}): JSX.Element {
  return (
    <div className="lockin-video-list-empty">
      <p>{emptyMessage}</p>
      <p className="lockin-video-list-hint">{supportedProviders}</p>
      {detectionHint !== undefined && detectionHint.length > 0 ? (
        <p className="lockin-video-list-hint">{detectionHint}</p>
      ) : null}
    </div>
  );
}

function VideoItemsList({
  videos,
  onSelectVideo,
  selectedVideoId,
  isVideoDisabled,
  renderItemBadge,
  renderItemActions,
  renderItemStatus,
}: {
  videos: DetectedVideo[];
  onSelectVideo: (video: DetectedVideo) => void;
  selectedVideoId: string | null | undefined;
  isVideoDisabled: ((video: DetectedVideo) => boolean) | undefined;
  renderItemBadge: VideoItemBadgeRenderer | undefined;
  renderItemActions: VideoItemActionRenderer | undefined;
  renderItemStatus: VideoItemStatusRenderer | undefined;
}): JSX.Element {
  return (
    <div className="lockin-video-list" role="list">
      {videos.map((video) => {
        const itemProps = buildVideoListItemProps({
          video,
          onSelectVideo,
          selectedVideoId,
          isVideoDisabled,
          renderItemBadge,
          renderItemActions,
          renderItemStatus,
        });
        return <VideoListItem key={`${video.provider}-${video.id}`} {...itemProps} />;
      })}
    </div>
  );
}

interface VideoListBodyProps {
  videos: DetectedVideo[];
  isLoading: boolean;
  error: string | undefined;
  detectionHint: string | undefined;
  authRequired: { provider: string; signInUrl: string } | undefined;
  emptyMessage: string;
  supportedProviders: string;
  onSelectVideo: (video: DetectedVideo) => void;
  selectedVideoId: string | null | undefined;
  isVideoDisabled: ((video: DetectedVideo) => boolean) | undefined;
  renderItemBadge: VideoItemBadgeRenderer | undefined;
  renderItemActions: VideoItemActionRenderer | undefined;
  renderItemStatus: VideoItemStatusRenderer | undefined;
}

function VideoListBody(props: VideoListBodyProps): JSX.Element {
  const {
    videos,
    isLoading,
    error,
    detectionHint,
    authRequired,
    emptyMessage,
    supportedProviders,
    onSelectVideo,
    selectedVideoId,
    isVideoDisabled,
    renderItemBadge,
    renderItemActions,
    renderItemStatus,
  } = props;

  const showError = Boolean(error) && videos.length === 0;

  if (isLoading) {
    return <VideoListLoadingState />;
  }
  if (authRequired !== undefined) {
    return (
      <AuthRequiredPrompt provider={authRequired.provider} signInUrl={authRequired.signInUrl} />
    );
  }
  if (showError) {
    return <VideoListErrorState error={error} />;
  }
  if (videos.length === 0) {
    return (
      <VideoListEmptyState
        emptyMessage={emptyMessage}
        supportedProviders={supportedProviders}
        detectionHint={detectionHint}
      />
    );
  }

  return (
    <VideoItemsList
      videos={videos}
      onSelectVideo={onSelectVideo}
      selectedVideoId={selectedVideoId}
      isVideoDisabled={isVideoDisabled}
      renderItemBadge={renderItemBadge}
      renderItemActions={renderItemActions}
      renderItemStatus={renderItemStatus}
    />
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
}: VideoListPanelProps): JSX.Element {
  return (
    <div className="lockin-video-list-panel">
      <VideoListHeader title={title} onClose={onClose} />
      <div className="lockin-video-list-body">
        <VideoListBody
          videos={videos}
          isLoading={isLoading}
          error={error}
          detectionHint={detectionHint}
          authRequired={authRequired}
          emptyMessage={emptyMessage}
          supportedProviders={supportedProviders}
          onSelectVideo={onSelectVideo}
          selectedVideoId={selectedVideoId}
          isVideoDisabled={isVideoDisabled}
          renderItemBadge={renderItemBadge}
          renderItemActions={renderItemActions}
          renderItemStatus={renderItemStatus}
        />
      </div>
      <VideoListFooter count={videos.length} />
    </div>
  );
}
