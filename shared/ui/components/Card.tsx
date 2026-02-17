/**
 * Card Component
 *
 * Reusable card component for content containers.
 * Uses Tailwind CSS with lockin design tokens for styling.
 */

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function Card({
  children,
  className = '',
  onClick,
  isActive = false,
}: CardProps): React.ReactElement {
  const isInteractive = onClick !== undefined;

  return (
    <div
      className={`p-lockin-3 border rounded-lockin-lg bg-surface transition-colors duration-lockin-base ${
        isActive
          ? 'border-accent bg-accent-surface shadow-lockin-focus-accent'
          : 'border-line hover:border-line-strong'
      } ${isInteractive ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onClick !== undefined) {
                  onClick();
                }
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
