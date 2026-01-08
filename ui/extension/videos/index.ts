/**
 * Generic Video Components
 *
 * Reusable components for video detection and selection.
 * Feature-specific code (Transcript, Key Takeaways, etc.) can extend
 * these via render props to inject custom badges, actions, and status.
 */

export { ProviderBadge } from './ProviderBadge';
export { VideoListItem } from './VideoListItem';
export type { VideoListItemProps } from './VideoListItem';
export { VideoListPanel } from './VideoListPanel';
export type { VideoListPanelProps } from './VideoListPanel';
export type {
    VideoItemRenderProps,
    VideoItemBadgeRenderer,
    VideoItemActionRenderer,
    VideoItemStatusRenderer,
} from './types';
