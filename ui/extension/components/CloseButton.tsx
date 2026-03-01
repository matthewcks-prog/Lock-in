/**
 * CloseButton Component
 *
 * A reusable, accessible close/dismiss button built on the lucide-react `X` icon.
 * Designed to replace all ad-hoc "x" / "A-" text close buttons throughout the UI
 * with a single, consistent, testable component.
 *
 * Design:
 * - Uses the project-standard `X` icon from lucide-react (already a project dependency)
 * - Applies `lockin-close-btn` by default so it inherits all existing token-based styles
 * - Accepts an optional `className` override for specialised contexts (e.g. tab close)
 * - Marked `memo` to avoid unnecessary re-renders inside large reactive trees
 */

import { memo } from 'react';
import { X } from 'lucide-react';

export interface CloseButtonProps {
  /** Callback invoked when the button is clicked. */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Accessible label describing what will be closed (required for screen-readers). */
  label: string;
  /** CSS class override. Defaults to `lockin-close-btn` (sidebar / panel close style). */
  className?: string;
  /** Whether the button is non-interactive. */
  disabled?: boolean;
  /** Lucide icon size in px. Defaults to 16. */
  iconSize?: number;
  /** Lucide stroke width. Defaults to 2. */
  strokeWidth?: number;
}

const DEFAULT_ICON_SIZE = 16;
const DEFAULT_STROKE_WIDTH = 2;

export const CloseButton = memo(function CloseButton({
  onClick,
  label,
  className = 'lockin-close-btn',
  disabled = false,
  iconSize = DEFAULT_ICON_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: CloseButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <X size={iconSize} strokeWidth={strokeWidth} aria-hidden="true" />
    </button>
  );
});
