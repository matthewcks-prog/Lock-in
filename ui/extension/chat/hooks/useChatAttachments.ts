/**
 * useChatAttachments Hook
 *
 * Manages attachment state for chat messages.
 * Handles file selection, preview URLs, upload tracking, and cleanup.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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

/** Generate a unique ID for attachments */
function generateId(): string {
  return `attach-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChatAttachments(
  options: UseChatAttachmentsOptions = {},
): UseChatAttachmentsReturn {
  const { maxAttachments = 5 } = options;
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  // Track preview URLs for cleanup
  const previewUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      setAttachments((prev) => {
        const remaining = maxAttachments - prev.length;
        if (remaining <= 0) return prev;

        const newAttachments: PendingAttachment[] = files.slice(0, remaining).map((file) => {
          // Create preview URL for images
          let previewUrl: string | undefined;
          if (file.type.startsWith('image/')) {
            previewUrl = URL.createObjectURL(file);
            previewUrlsRef.current.add(previewUrl);
          }

          const attachment: PendingAttachment = {
            id: generateId(),
            file,
            status: 'pending' as const,
          };
          if (previewUrl) {
            attachment.previewUrl = previewUrl;
          }
          return attachment;
        });

        return [...prev, ...newAttachments];
      });
    },
    [maxAttachments],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);

      // Cleanup preview URL
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
        previewUrlsRef.current.delete(attachment.previewUrl);
      }

      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      // Cleanup all preview URLs
      prev.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
          previewUrlsRef.current.delete(attachment.previewUrl);
        }
      });
      return [];
    });
  }, []);

  const setAttachmentStatus = useCallback(
    (id: string, status: PendingAttachment['status'], assetId?: string, error?: string) => {
      setAttachments((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          let next: PendingAttachment = { ...a, status };
          if (assetId) {
            next.assetId = assetId;
          }
          if (error !== undefined) {
            if (error) {
              next.error = error;
            }
          } else if (status !== 'error' && next.error) {
            const { error: _removed, ...rest } = next;
            next = rest;
          }
          return next;
        }),
      );
    },
    [],
  );

  const getUploadedAssetIds = useCallback((): string[] => {
    return attachments.filter((a) => a.status === 'uploaded' && a.assetId).map((a) => a.assetId!);
  }, [attachments]);

  const isUploading = attachments.some(
    (a) => a.status === 'uploading' || a.status === 'processing',
  );
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
