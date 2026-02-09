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

export function Card({ children, className = '', onClick, isActive = false }: CardProps) {
  return (
    <div
      className={`p-lockin-3 border rounded-lockin-lg bg-surface transition-colors duration-lockin-base ${
        isActive
          ? 'border-accent bg-accent-surface shadow-lockin-focus-accent'
          : 'border-line hover:border-line-strong'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
