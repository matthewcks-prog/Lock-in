/**
 * VideoListItem Component
 *
 * Generic selectable video list item with render props for customization.
 * Feature-specific code (Transcript, Key Takeaways, etc.) can inject:
 * - Custom badges after the title (renderBadge)
 * - Custom actions below the item (renderActions)
 * - Custom status indicators in the action area (renderStatus)
 */

import type { DetectedVideo } from '@core/transcripts/types';
import { ProviderBadge } from './ProviderBadge';
import type {
  VideoItemBadgeRenderer,
  VideoItemActionRenderer,
  VideoItemStatusRenderer,
} from './types';

export interface VideoListItemProps {
  /** The video to display */
  video: DetectedVideo;
  /** Callback when the video is selected */
  onSelect: () => void;
  /** Whether this item is disabled for interaction */
  isDisabled?: boolean;
  /** Whether this item is currently selected/active */
  isSelected?: boolean;
  /** Optional custom badge to render after the title */
  renderBadge?: VideoItemBadgeRenderer;
  /** Optional custom actions to render below the item */
  renderActions?: VideoItemActionRenderer;
  /** Optional custom status indicator in the action area (defaults to spinner when selected) */
  renderStatus?: VideoItemStatusRenderer;
}

export function VideoListItem({
  video,
  onSelect,
  isDisabled = false,
  isSelected = false,
  renderBadge,
  renderActions,
  renderStatus,
}: VideoListItemProps) {
  const renderProps = { video, isSelected, isDisabled };

  // Default status: spinner when selected, arrow otherwise
  const defaultStatus = isSelected ? (
    <span className="lockin-inline-spinner" />
  ) : (
    <span className="lockin-video-extract-icon">→</span>
  );

  return (
    <div
      className={`lockin-video-item ${isSelected ? 'is-extracting' : ''}`}
      role="listitem"
    >
      <button
        className="lockin-video-item-main"
        onClick={onSelect}
        disabled={isDisabled}
        type="button"
      >
        <div className="lockin-video-item-content">
          <div className="lockin-video-item-header">
            <ProviderBadge provider={video.provider} />
            <span className="lockin-video-item-title">{video.title}</span>
            {renderBadge?.(renderProps)}
          </div>
        </div>
        <div className="lockin-video-item-action">
          {renderStatus ? renderStatus(renderProps) : defaultStatus}
        </div>
      </button>

      {renderActions?.(renderProps)}
    </div>
  );
}
