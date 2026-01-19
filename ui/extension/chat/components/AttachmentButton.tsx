/**
 * AttachmentButton Component
 *
 * A button that triggers file selection for chat attachments.
 * Supports images, documents, and code files.
 */

import React, { useRef, useCallback } from 'react';

/** Supported MIME types for chat attachments */
const ACCEPTED_TYPES = [
  // Images (vision-compatible)
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Code files
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'text/x-python',
  'text/x-java',
  'text/x-c',
  'text/x-c++',
  'text/css',
  'text/html',
  'application/json',
  'text/x-rust',
  'text/x-go',
].join(',');

/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface AttachmentButtonProps {
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Maximum number of files allowed */
  maxFiles?: number;
  /** Current number of attached files */
  currentFileCount?: number;
  /** Custom class name */
  className?: string;
}

export function AttachmentButton({
  onFilesSelected,
  disabled = false,
  maxFiles = 5,
  currentFileCount = 0,
  className = '',
}: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const remaining = maxFiles - currentFileCount;

      // Limit to remaining slots
      const validFiles = files.slice(0, remaining).filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`File ${file.name} exceeds size limit`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }

      // Reset input so the same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onFilesSelected, maxFiles, currentFileCount],
  );

  const isAtLimit = currentFileCount >= maxFiles;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isAtLimit}
        className={`lockin-chat-attach-btn ${className}`}
        title={isAtLimit ? `Maximum ${maxFiles} files` : 'Attach file'}
        aria-label="Attach file"
      >
        {/* Paperclip icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}
