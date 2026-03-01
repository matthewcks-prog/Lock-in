/**
 * MessageActionBar Component
 *
 * Composable action bar for chat messages.
 * Renders a horizontal row of icon buttons with tooltips.
 * Used for both user messages (edit, copy) and assistant messages (copy, save note, regenerate).
 *
 * Design:
 * - Compact icon buttons with tooltips
 * - Appears on hover for user messages, always visible for assistant
 * - Accessible: each button has aria-label and title
 */

import { memo } from 'react';
import type { ReactNode } from 'react';

export interface MessageAction {
  /** Unique key for the action */
  key: string;
  /** Icon to display (emoji or text) */
  icon: ReactNode;
  /** Accessible label / tooltip */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Whether the action is in a loading state */
  loading?: boolean;
}

export interface MessageActionBarProps {
  /** Actions to render */
  actions: MessageAction[];
  /** Additional CSS class */
  className?: string;
}

export const MessageActionBar = memo(function MessageActionBar({
  actions,
  className = '',
}: MessageActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div
      className={`lockin-msg-action-bar ${className}`.trim()}
      role="toolbar"
      aria-label="Message actions"
    >
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className="lockin-msg-action-btn"
          onClick={action.onClick}
          disabled={action.disabled === true || action.loading === true}
          aria-label={action.label}
          title={action.label}
        >
          {action.loading === true ? (
            <span className="lockin-msg-action-spinner" aria-hidden="true" />
          ) : (
            action.icon
          )}
        </button>
      ))}
    </div>
  );
});
