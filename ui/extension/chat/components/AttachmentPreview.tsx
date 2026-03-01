/**
 * AttachmentPreview Component
 *
 * Displays a preview of pending attachments before sending a message.
 * Shows thumbnails for images and icons for documents/code.
 */

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;

export interface PendingAttachment {
  /** Unique identifier for the attachment */
  id: string;
  /** The file object */
  file: File;
  /** Preview URL for images (created with URL.createObjectURL) */
  previewUrl?: string;
  /** Upload status */
  status: 'pending' | 'uploading' | 'processing' | 'uploaded' | 'error';
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

type AttachmentStatus = PendingAttachment['status'];

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
  if (parts.length <= 1) return '';
  const last = parts[parts.length - 1];
  return last !== undefined && last.length > 0 ? last.toUpperCase() : '';
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KILOBYTE) return `${bytes} B`;
  if (bytes < BYTES_PER_MEGABYTE) return `${(bytes / BYTES_PER_KILOBYTE).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MEGABYTE).toFixed(1)} MB`;
}

function isUploadInProgress(status: AttachmentStatus): boolean {
  return status === 'uploading' || status === 'processing';
}

function getItemClassName(status: AttachmentStatus): string {
  const classes = ['lockin-chat-attachment-item'];
  if (status === 'error') {
    classes.push('is-error');
  }
  if (isUploadInProgress(status)) {
    classes.push('is-uploading');
  }
  return classes.join(' ');
}

function getStatusContent(attachment: PendingAttachment): string | JSX.Element {
  if (attachment.status === 'uploading') return 'Uploading...';
  if (attachment.status === 'processing') return 'Processing...';
  if (attachment.status === 'error') {
    const message =
      attachment.error !== undefined && attachment.error.length > 0
        ? attachment.error
        : 'Upload failed';
    return <span className="lockin-chat-attachment-error">{message}</span>;
  }
  return formatFileSize(attachment.file.size);
}

function DocumentIcon(): JSX.Element {
  return (
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
  );
}

function RemoveIcon(): JSX.Element {
  return (
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
  );
}

function AttachmentThumb({ attachment }: { attachment: PendingAttachment }): JSX.Element {
  const fileType = getFileType(attachment.file.type);

  if (
    fileType === 'image' &&
    attachment.previewUrl !== undefined &&
    attachment.previewUrl.length > 0
  ) {
    return (
      <img
        src={attachment.previewUrl}
        alt={attachment.file.name}
        className="lockin-chat-attachment-thumb-img"
      />
    );
  }
  if (fileType === 'document') {
    return <DocumentIcon />;
  }

  const extension = getExtension(attachment.file.name);
  return (
    <span className="lockin-chat-attachment-extension">
      {extension.length > 0 ? extension : '?'}
    </span>
  );
}

function AttachmentMeta({ attachment }: { attachment: PendingAttachment }): JSX.Element {
  return (
    <div className="lockin-chat-attachment-meta">
      <p className="lockin-chat-attachment-name" title={attachment.file.name}>
        {attachment.file.name}
      </p>
      <p className="lockin-chat-attachment-size">{getStatusContent(attachment)}</p>
    </div>
  );
}

function AttachmentRemoveButton({
  attachment,
  disabled,
  onRemove,
}: {
  attachment: PendingAttachment;
  disabled?: boolean | undefined;
  onRemove: () => void;
}): JSX.Element {
  const isDisabled = disabled === true || isUploadInProgress(attachment.status);

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={isDisabled}
      className="lockin-chat-attachment-remove"
      title="Remove attachment"
      aria-label={`Remove ${attachment.file.name}`}
    >
      <RemoveIcon />
    </button>
  );
}

function UploadOverlay(): JSX.Element {
  return (
    <div className="lockin-chat-attachment-overlay">
      <span className="lockin-inline-spinner" />
    </div>
  );
}

function AttachmentItem({
  attachment,
  onRemove,
  disabled,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
  disabled?: boolean | undefined;
}): JSX.Element {
  const isUploading = isUploadInProgress(attachment.status);

  return (
    <div className={getItemClassName(attachment.status)}>
      <div className="lockin-chat-attachment-thumb">
        <AttachmentThumb attachment={attachment} />
      </div>
      <AttachmentMeta attachment={attachment} />
      <AttachmentRemoveButton attachment={attachment} disabled={disabled} onRemove={onRemove} />
      {isUploading ? <UploadOverlay /> : null}
    </div>
  );
}

export function AttachmentPreview({
  attachments,
  onRemove,
  disabled = false,
}: AttachmentPreviewProps): JSX.Element | null {
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
