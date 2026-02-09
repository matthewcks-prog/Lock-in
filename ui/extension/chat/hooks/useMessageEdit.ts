/**
 * useMessageEdit Hook
 *
 * Manages the edit state for user messages. Handles:
 * - Tracking which message is being edited
 * - Draft content for the edit
 * - Submitting edits to the API (truncate-on-edit)
 * - Updating the local query cache with canonical timeline
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@api/client';
import type { ChatMessage } from '../types';
import { normalizeChatMessage } from '../types';
import { chatMessagesKeys } from './useChatMessages';

export interface UseMessageEditOptions {
  apiClient: ApiClient | null;
  chatId: string | null;
  /** Cancel any active stream before editing */
  cancelStream?: () => void;
  /** Callback after edit succeeds — used to auto-regenerate the assistant reply */
  onEditComplete?: (editedContent: string, canonicalMessages: ChatMessage[]) => void;
}

export interface UseMessageEditReturn {
  /** ID of the message currently being edited, or null */
  editingMessageId: string | null;
  /** Draft content for the current edit */
  editDraft: string;
  /** Whether an edit submission is in progress */
  isSubmittingEdit: boolean;
  /** Start editing a message */
  startEdit: (messageId: string, currentContent: string) => void;
  /** Cancel the current edit */
  cancelEdit: () => void;
  /** Update the draft content */
  setEditDraft: (content: string) => void;
  /** Submit the edit to the API */
  submitEdit: () => Promise<boolean>;
}

/**
 * Hook for editing user messages with truncate-on-edit semantics.
 */
export function useMessageEdit(options: UseMessageEditOptions): UseMessageEditReturn {
  const { apiClient, chatId, cancelStream, onEditComplete } = options;
  const queryClient = useQueryClient();

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const startEdit = useCallback(
    (messageId: string, currentContent: string) => {
      // Auto-cancel any active stream
      cancelStream?.();
      setEditingMessageId(messageId);
      setEditDraft(currentContent);
    },
    [cancelStream],
  );

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditDraft('');
  }, []);

  const submitEdit = useCallback(async (): Promise<boolean> => {
    if (!apiClient?.editMessage || !chatId || !editingMessageId) {
      return false;
    }

    const trimmed = editDraft.trim();
    if (!trimmed) {
      return false;
    }

    setIsSubmittingEdit(true);

    try {
      const result = await apiClient.editMessage(chatId, editingMessageId, trimmed);

      // Update the query cache with the new canonical timeline
      const normalizedMessages = result.canonicalMessages.map((msg: Record<string, unknown>) =>
        normalizeChatMessage(msg),
      );

      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), normalizedMessages);

      // Clear edit state
      setEditingMessageId(null);
      setEditDraft('');

      // Notify caller to auto-regenerate with the edited content
      onEditComplete?.(trimmed, normalizedMessages);

      return true;
    } catch (error) {
      console.error('[useMessageEdit] Failed to submit edit:', error);
      return false;
    } finally {
      setIsSubmittingEdit(false);
    }
  }, [apiClient, chatId, editingMessageId, editDraft, queryClient]);

  return {
    editingMessageId,
    editDraft,
    isSubmittingEdit,
    startEdit,
    cancelEdit,
    setEditDraft,
    submitEdit,
  };
}
