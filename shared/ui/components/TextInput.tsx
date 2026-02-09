/**
 * TextInput Component
 *
 * Reusable text input component.
 * Uses Tailwind CSS with lockin design tokens for styling.
 */

import React, { useId } from 'react';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function TextInput({ label, error, helperText, className = '', ...props }: TextInputProps) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText && !error ? `${inputId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-lockin-sm font-medium text-text-body">
          {label}
        </label>
      )}
      <input
        className={`px-lockin-3 py-lockin-2 border rounded-lockin-lg text-lockin-md transition-colors duration-lockin-base focus:outline-none focus-visible:ring-2 ${
          error
            ? 'border-danger focus-visible:ring-danger'
            : 'border-line-strong focus-visible:ring-accent'
        } ${className}`}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId ?? helperId}
        {...props}
      />
      {error && (
        <span id={errorId} className="text-lockin-sm text-danger" role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={helperId} className="text-lockin-sm text-text-muted">
          {helperText}
        </span>
      )}
    </div>
  );
}
