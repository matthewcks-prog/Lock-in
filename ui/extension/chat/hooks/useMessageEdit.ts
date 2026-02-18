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
  /** Callback after edit succeeds - used to auto-regenerate the assistant reply */
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

function canSubmitEdit({
  apiClient,
  chatId,
  editingMessageId,
  draft,
}: {
  apiClient: ApiClient | null;
  chatId: string | null;
  editingMessageId: string | null;
  draft: string;
}): boolean {
  return (
    apiClient !== null &&
    apiClient.editMessage !== undefined &&
    chatId !== null &&
    chatId.length > 0 &&
    editingMessageId !== null &&
    editingMessageId.length > 0 &&
    draft.trim().length > 0
  );
}

function normalizeCanonicalMessages(canonicalMessages: Record<string, unknown>[]): ChatMessage[] {
  return canonicalMessages.map((message) => normalizeChatMessage(message));
}

function clearEditState(
  setEditingMessageId: (value: string | null) => void,
  setEditDraft: (value: string) => void,
): void {
  setEditingMessageId(null);
  setEditDraft('');
}

function updateMessageCache(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string,
  messages: ChatMessage[],
): void {
  queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), messages);
}

interface EditSubmitContext {
  apiClient: ApiClient;
  chatId: string;
  editingMessageId: string;
  trimmed: string;
}

function resolveEditSubmitContext({
  apiClient,
  chatId,
  editingMessageId,
  draft,
}: {
  apiClient: ApiClient | null;
  chatId: string | null;
  editingMessageId: string | null;
  draft: string;
}): EditSubmitContext | null {
  if (!canSubmitEdit({ apiClient, chatId, editingMessageId, draft })) {
    return null;
  }
  if (
    apiClient === null ||
    apiClient.editMessage === undefined ||
    chatId === null ||
    editingMessageId === null
  ) {
    return null;
  }
  return {
    apiClient,
    chatId,
    editingMessageId,
    trimmed: draft.trim(),
  };
}

async function executeEditRequest(
  context: EditSubmitContext,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<ChatMessage[]> {
  const response = await context.apiClient.editMessage(
    context.chatId,
    context.editingMessageId,
    context.trimmed,
  );
  const normalized = normalizeCanonicalMessages(response.canonicalMessages);
  updateMessageCache(queryClient, context.chatId, normalized);
  return normalized;
}

function handleEditSuccess(
  context: EditSubmitContext,
  normalized: ChatMessage[],
  callbacks: {
    onEditComplete: ((editedContent: string, canonicalMessages: ChatMessage[]) => void) | undefined;
    setEditingMessageId: (value: string | null) => void;
    setEditDraft: (value: string) => void;
  },
): void {
  clearEditState(callbacks.setEditingMessageId, callbacks.setEditDraft);

  if (callbacks.onEditComplete !== undefined) {
    try {
      callbacks.onEditComplete(context.trimmed, normalized);
    } catch (regenerationError) {
      console.warn('Edit succeeded but regeneration failed:', regenerationError);
    }
  }
}

async function submitEditRequest({
  apiClient,
  chatId,
  editingMessageId,
  editDraft,
  queryClient,
  onEditComplete,
  setEditingMessageId,
  setEditDraft,
  setIsSubmittingEdit,
}: {
  apiClient: ApiClient | null;
  chatId: string | null;
  editingMessageId: string | null;
  editDraft: string;
  queryClient: ReturnType<typeof useQueryClient>;
  onEditComplete: ((editedContent: string, canonicalMessages: ChatMessage[]) => void) | undefined;
  setEditingMessageId: (value: string | null) => void;
  setEditDraft: (value: string) => void;
  setIsSubmittingEdit: (value: boolean) => void;
}): Promise<boolean> {
  const context = resolveEditSubmitContext({
    apiClient,
    chatId,
    editingMessageId,
    draft: editDraft,
  });
  if (context === null) return false;

  setIsSubmittingEdit(true);

  try {
    const normalized = await executeEditRequest(context, queryClient);
    handleEditSuccess(context, normalized, {
      onEditComplete,
      setEditingMessageId,
      setEditDraft,
    });
    return true;
  } catch (error) {
    console.error('Edit submission failed:', error);
    return false;
  } finally {
    setIsSubmittingEdit(false);
  }
}

function useSubmitEdit({
  apiClient,
  chatId,
  editingMessageId,
  editDraft,
  queryClient,
  onEditComplete,
  setEditingMessageId,
  setEditDraft,
  setIsSubmittingEdit,
}: {
  apiClient: ApiClient | null;
  chatId: string | null;
  editingMessageId: string | null;
  editDraft: string;
  queryClient: ReturnType<typeof useQueryClient>;
  onEditComplete: ((editedContent: string, canonicalMessages: ChatMessage[]) => void) | undefined;
  setEditingMessageId: (value: string | null) => void;
  setEditDraft: (value: string) => void;
  setIsSubmittingEdit: (value: boolean) => void;
}): UseMessageEditReturn['submitEdit'] {
  return useCallback(async (): Promise<boolean> => {
    return submitEditRequest({
      apiClient,
      chatId,
      editingMessageId,
      editDraft,
      queryClient,
      onEditComplete,
      setEditingMessageId,
      setEditDraft,
      setIsSubmittingEdit,
    });
  }, [
    apiClient,
    chatId,
    editingMessageId,
    editDraft,
    onEditComplete,
    queryClient,
    setEditDraft,
    setEditingMessageId,
    setIsSubmittingEdit,
  ]);
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
      cancelStream?.();
      setEditingMessageId(messageId);
      setEditDraft(currentContent);
    },
    [cancelStream],
  );

  const cancelEdit = useCallback(() => clearEditState(setEditingMessageId, setEditDraft), []);
  const submitEdit = useSubmitEdit({
    apiClient,
    chatId,
    editingMessageId,
    editDraft,
    queryClient,
    onEditComplete,
    setEditingMessageId,
    setEditDraft,
    setIsSubmittingEdit,
  });

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
