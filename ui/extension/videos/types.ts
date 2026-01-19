/**
 * Shared types for generic video components
 *
 * Uses render props pattern for customization - features inject
 * their own badges, actions, and status indicators.
 */

import type { DetectedVideo } from '@core/transcripts/types';
import type { ReactNode } from 'react';

// -----------------------------------------------------------------------------
// Render Props Types
// -----------------------------------------------------------------------------

/**
 * Props passed to render prop callbacks for video items
 */
export interface VideoItemRenderProps {
  /** The video being rendered */
  video: DetectedVideo;
  /** Whether this video is currently selected/active */
  isSelected?: boolean;
  /** Whether this video item is disabled for interaction */
  isDisabled?: boolean;
}

/**
 * Render prop for custom badges shown after the video title
 * @example Transcript feature: "No transcript" badge
 */
export type VideoItemBadgeRenderer = (props: VideoItemRenderProps) => ReactNode;

/**
 * Render prop for custom actions rendered below the video item
 * @example Transcript feature: AI transcription button + progress
 */
export type VideoItemActionRenderer = (props: VideoItemRenderProps) => ReactNode;

/**
 * Render prop for custom status indicators in the item's action area
 * @example Custom spinner, checkmark, or error icon
 */
export type VideoItemStatusRenderer = (props: VideoItemRenderProps) => ReactNode;
