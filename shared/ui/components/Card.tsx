/**
 * Card Component
 *
 * Reusable card component for content containers.
 * Uses Tailwind CSS for styling.
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
      className={`p-3 border rounded-lg bg-white transition-colors ${
        isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
