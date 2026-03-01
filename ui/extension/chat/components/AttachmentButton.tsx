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
const BYTES_PER_KIB = 1024;
const KIB_PER_MIB = 1024;
const MAX_FILE_SIZE_MB = 10;
const DEFAULT_MAX_FILES = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * BYTES_PER_KIB * KIB_PER_MIB;

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

function filterValidFiles(fileList: FileList, maxFiles: number, currentFileCount: number): File[] {
  const remaining = maxFiles - currentFileCount;
  return Array.from(fileList)
    .slice(0, remaining)
    .filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds size limit`);
        return false;
      }
      return true;
    });
}

function resetInputValue(inputRef: React.RefObject<HTMLInputElement>): void {
  if (inputRef.current !== null) {
    inputRef.current.value = '';
  }
}

function AttachmentIcon(): JSX.Element {
  return (
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
  );
}

export function AttachmentButton({
  onFilesSelected,
  disabled = false,
  maxFiles = DEFAULT_MAX_FILES,
  currentFileCount = 0,
  className = '',
}: AttachmentButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (fileList === null || fileList.length === 0) return;

      const validFiles = filterValidFiles(fileList, maxFiles, currentFileCount);

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }

      resetInputValue(inputRef);
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
        <AttachmentIcon />
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
