/**
 * AttachmentPreview Component
 *
 * Displays a preview of pending attachments before sending a message.
 * Shows thumbnails for images, icons for documents/code.
 */

import { useMemo } from 'react';

export interface PendingAttachment {
  /** Unique identifier for the attachment */
  id: string;
  /** The file object */
  file: File;
  /** Preview URL for images (created with URL.createObjectURL) */
  previewUrl?: string;
  /** Upload status */
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  /** Uploaded asset ID (after upload) */
  assetId?: string;
  /** Error message if upload failed */
  error?: string;
}

export interface AttachmentPreviewProps {
  /** List of pending attachments */
  attachments: PendingAttachment[];
  /** Callback to remove an attachment */
  onRemove: (id: string) => void;
  /** Whether removing is disabled (e.g., during upload) */
  disabled?: boolean;
}

/** Get file type category from MIME type */
function getFileType(mimeType: string): 'image' | 'document' | 'code' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || mimeType.includes('document')) return 'document';
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript'
  ) {
    return 'code';
  }
  return 'other';
}

/** Get file extension from filename */
function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({
  attachment,
  onRemove,
  disabled,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const fileType = useMemo(() => getFileType(attachment.file.type), [attachment.file.type]);
  const extension = useMemo(() => getExtension(attachment.file.name), [attachment.file.name]);

  return (
    <div
      className={`lockin-chat-attachment-item ${
        attachment.status === 'error' ? 'is-error' : ''
      } ${attachment.status === 'uploading' ? 'is-uploading' : ''}`}
    >
      {/* Preview/Icon */}
      <div className="lockin-chat-attachment-thumb">
        {fileType === 'image' && attachment.previewUrl ? (
          <img
            src={attachment.previewUrl}
            alt={attachment.file.name}
            className="lockin-chat-attachment-thumb-img"
          />
        ) : fileType === 'document' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="lockin-chat-attachment-doc-icon"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        ) : (
          <span className="lockin-chat-attachment-extension">{extension || '?'}</span>
        )}
      </div>

      {/* File info */}
      <div className="lockin-chat-attachment-meta">
        <p className="lockin-chat-attachment-name" title={attachment.file.name}>
          {attachment.file.name}
        </p>
        <p className="lockin-chat-attachment-size">
          {attachment.status === 'uploading' ? (
            'Uploading...'
          ) : attachment.status === 'error' ? (
            <span className="lockin-chat-attachment-error">
              {attachment.error || 'Upload failed'}
            </span>
          ) : (
            formatFileSize(attachment.file.size)
          )}
        </p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || attachment.status === 'uploading'}
        className="lockin-chat-attachment-remove"
        title="Remove attachment"
        aria-label={`Remove ${attachment.file.name}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Upload spinner overlay */}
      {attachment.status === 'uploading' && (
        <div className="lockin-chat-attachment-overlay">
          <span className="lockin-inline-spinner" />
        </div>
      )}
    </div>
  );
}

export function AttachmentPreview({
  attachments,
  onRemove,
  disabled = false,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="lockin-chat-attachment-preview">
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
