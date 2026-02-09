/**
 * Button Component
 *
 * Reusable button component with variants.
 * Uses Tailwind CSS with lockin design tokens for styling.
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-lockin-base rounded-lockin-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-accent text-white hover:bg-accent-strong active:bg-accent-stronger focus-visible:ring-accent',
    secondary:
      'bg-surface-muted text-text-strong border border-line hover:bg-line active:bg-line-strong focus-visible:ring-accent',
    ghost:
      'bg-transparent text-text-body hover:bg-surface-muted active:bg-line focus-visible:ring-accent',
    danger:
      'bg-danger text-white hover:bg-danger-strong active:bg-danger-strong focus-visible:ring-danger',
  };

  const sizeClasses = {
    sm: 'px-lockin-2 py-lockin-1 text-lockin-sm min-h-[28px]',
    md: 'px-lockin-4 py-lockin-2 text-lockin-md min-h-[36px]',
    lg: 'px-lockin-6 py-lockin-3 text-lockin-lg min-h-[44px]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      <span className={isLoading ? 'opacity-80' : undefined}>{children}</span>
    </button>
  );
}
