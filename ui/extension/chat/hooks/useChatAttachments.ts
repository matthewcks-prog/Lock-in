/**
 * useChatAttachments Hook
 *
 * Manages attachment state for chat messages.
 * Handles file selection, preview URLs, upload tracking, and cleanup.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PendingAttachment } from '../components/AttachmentPreview';

interface UseChatAttachmentsOptions {
  /** Maximum number of attachments allowed */
  maxAttachments?: number;
}

interface UseChatAttachmentsReturn {
  /** List of pending attachments */
  attachments: PendingAttachment[];
  /** Add files to the attachment list */
  addFiles: (files: File[]) => void;
  /** Remove an attachment by ID */
  removeAttachment: (id: string) => void;
  /** Clear all attachments */
  clearAttachments: () => void;
  /** Update attachment status after upload */
  setAttachmentStatus: (
    id: string,
    status: PendingAttachment['status'],
    assetId?: string,
    error?: string,
  ) => void;
  /** Get asset IDs for uploaded attachments */
  getUploadedAssetIds: () => string[];
  /** Whether any attachments are currently uploading or processing */
  isUploading: boolean;
  /** Whether max attachments reached */
  isAtLimit: boolean;
}

const RANDOM_RADIX_BASE36 = 36;
const RANDOM_ID_SLICE_START = 2;
const RANDOM_ID_SLICE_END = 9;
const DEFAULT_MAX_ATTACHMENTS = 5;
type PreviewUrlRef = MutableRefObject<Set<string>>;

/** Generate a unique ID for attachments */
function generateId(): string {
  return `attach-${Date.now()}-${Math.random().toString(RANDOM_RADIX_BASE36).slice(RANDOM_ID_SLICE_START, RANDOM_ID_SLICE_END)}`;
}

function revokePreviewUrl(previewUrl: string | undefined, previewUrlsRef: PreviewUrlRef): void {
  if (previewUrl !== undefined && previewUrl.length > 0) {
    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
  }
}

function createAttachment(file: File, previewUrlsRef: PreviewUrlRef): PendingAttachment {
  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
  if (previewUrl !== undefined) {
    previewUrlsRef.current.add(previewUrl);
  }

  const attachment: PendingAttachment = {
    id: generateId(),
    file,
    status: 'pending',
  };
  if (previewUrl !== undefined && previewUrl.length > 0) {
    attachment.previewUrl = previewUrl;
  }
  return attachment;
}

function appendAttachments({
  previous,
  files,
  maxAttachments,
  previewUrlsRef,
}: {
  previous: PendingAttachment[];
  files: File[];
  maxAttachments: number;
  previewUrlsRef: PreviewUrlRef;
}): PendingAttachment[] {
  const remaining = maxAttachments - previous.length;
  if (remaining <= 0) return previous;

  const next = files.slice(0, remaining).map((file) => createAttachment(file, previewUrlsRef));
  return [...previous, ...next];
}

function removeAttachmentById({
  previous,
  id,
  previewUrlsRef,
}: {
  previous: PendingAttachment[];
  id: string;
  previewUrlsRef: PreviewUrlRef;
}): PendingAttachment[] {
  const attachment = previous.find((candidate) => candidate.id === id);
  revokePreviewUrl(attachment?.previewUrl, previewUrlsRef);
  return previous.filter((candidate) => candidate.id !== id);
}

function clearAttachmentList({
  previous,
  previewUrlsRef,
}: {
  previous: PendingAttachment[];
  previewUrlsRef: PreviewUrlRef;
}): PendingAttachment[] {
  previous.forEach((attachment) => revokePreviewUrl(attachment.previewUrl, previewUrlsRef));
  return [];
}

function updateAttachmentListStatus({
  previous,
  id,
  status,
  assetId,
  error,
}: {
  previous: PendingAttachment[];
  id: string;
  status: PendingAttachment['status'];
  assetId: string | undefined;
  error: string | undefined;
}): PendingAttachment[] {
  return previous.map((attachment) => {
    if (attachment.id !== id) return attachment;
    let next: PendingAttachment = { ...attachment, status };
    if (assetId !== undefined && assetId.length > 0) {
      next.assetId = assetId;
    }
    if (error !== undefined && error.length > 0) {
      next.error = error;
    } else if (status !== 'error' && next.error !== undefined && next.error.length > 0) {
      const { error: _removed, ...rest } = next;
      next = rest;
    }
    return next;
  });
}

function collectUploadedAssetIds(attachments: PendingAttachment[]): string[] {
  return attachments.flatMap((attachment) => {
    if (attachment.status !== 'uploaded') return [];
    const assetId = attachment.assetId;
    return assetId !== undefined && assetId.length > 0 ? [assetId] : [];
  });
}

function hasActiveUploads(attachments: PendingAttachment[]): boolean {
  return attachments.some((attachment) => {
    return attachment.status === 'uploading' || attachment.status === 'processing';
  });
}

function usePreviewCleanup(previewUrlsRef: PreviewUrlRef): void {
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [previewUrlsRef]);
}

export function useChatAttachments(
  options: UseChatAttachmentsOptions = {},
): UseChatAttachmentsReturn {
  const { maxAttachments = DEFAULT_MAX_ATTACHMENTS } = options;
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  usePreviewCleanup(previewUrlsRef);

  const addFiles = useCallback(
    (files: File[]) => {
      setAttachments((previous) => {
        return appendAttachments({ previous, files, maxAttachments, previewUrlsRef });
      });
    },
    [maxAttachments],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((previous) => {
      return removeAttachmentById({ previous, id, previewUrlsRef });
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((previous) => {
      return clearAttachmentList({ previous, previewUrlsRef });
    });
  }, []);

  const setAttachmentStatus = useCallback(
    (id: string, status: PendingAttachment['status'], assetId?: string, error?: string) => {
      setAttachments((previous) => {
        return updateAttachmentListStatus({ previous, id, status, assetId, error });
      });
    },
    [],
  );

  const getUploadedAssetIds = useCallback(
    () => collectUploadedAssetIds(attachments),
    [attachments],
  );
  const isUploading = hasActiveUploads(attachments);
  const isAtLimit = attachments.length >= maxAttachments;

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    setAttachmentStatus,
    getUploadedAssetIds,
    isUploading,
    isAtLimit,
  };
}
