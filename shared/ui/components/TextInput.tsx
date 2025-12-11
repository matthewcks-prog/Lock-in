/**
 * TextInput Component
 *
 * Reusable text input component.
 * Uses Tailwind CSS for styling.
 */

import React, { useId } from "react";

export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function TextInput({
  label,
  error,
  helperText,
  className = "",
  ...props
}: TextInputProps) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText && !error ? `${inputId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={`px-3 py-2 border rounded-md text-base focus:outline-none focus:ring-2 transition-colors ${
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        } ${className}`}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId ?? helperId}
        {...props}
      />
      {error && (
        <span id={errorId} className="text-sm text-red-600">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={helperId} className="text-sm text-gray-500">
          {helperText}
        </span>
      )}
    </div>
  );
}
