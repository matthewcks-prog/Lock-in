import { useLayoutEffect } from 'react';
import type { ApiClient, StreamErrorEvent } from '@api/client';
import type { useChat, useChatAttachments, useChatInput } from '../chat';
import type { StorageAdapter } from './types';

export function buildChatOptions({
  apiClient,
  pageUrl,
  courseCode,
  storage,
}: {
  apiClient: ApiClient | null;
  pageUrl: string;
  courseCode: string | null;
  storage?: StorageAdapter;
}): {
  apiClient: ApiClient | null;
  pageUrl: string;
  courseCode: string | null;
  storage?: StorageAdapter;
  enableStreaming: boolean;
} {
  const options = { apiClient, pageUrl, courseCode, enableStreaming: true };
  if (storage !== undefined) {
    return { ...options, storage };
  }
  return options;
}

export function useSyncTextareaHeight({
  isOpen,
  isActive,
  inputValue,
  syncTextareaHeight,
}: {
  isOpen: boolean;
  isActive: boolean;
  inputValue: string;
  syncTextareaHeight: () => void;
}): void {
  useLayoutEffect(() => {
    if (!isOpen || !isActive) return;
    syncTextareaHeight();
  }, [isOpen, isActive, inputValue, syncTextareaHeight]);
}

export function buildChatSectionViewModel({
  chat,
  attachmentState,
  inputState,
  composerState,
  hasPendingAttachments,
  handleSaveNote,
  maxAttachments,
}: {
  chat: ReturnType<typeof useChat>;
  attachmentState: ReturnType<typeof useChatAttachments>;
  inputState: ReturnType<typeof useChatInput>;
  composerState: {
    composerError: string | null;
    safetyWarning: string | null;
    dismissSafetyWarning: () => void;
  };
  hasPendingAttachments: boolean;
  handleSaveNote: (content: string) => void;
  maxAttachments: number;
}): {
  chat: ReturnType<typeof useChat>;
  attachmentState: ReturnType<typeof useChatAttachments>;
  inputState: ReturnType<typeof useChatInput>;
  composerError: string | null;
  safetyWarning: string | null;
  dismissSafetyWarning: () => void;
  canSend: boolean;
  isStreaming: boolean;
  streamError: StreamErrorEvent | null | undefined;
  maxAttachments: number;
  handleSaveNote: (content: string) => void;
} {
  return {
    chat,
    attachmentState,
    inputState,
    composerError: composerState.composerError,
    safetyWarning: composerState.safetyWarning,
    dismissSafetyWarning: composerState.dismissSafetyWarning,
    canSend: Boolean(inputState.value.trim()) || hasPendingAttachments,
    isStreaming: Boolean(chat.streaming?.isStreaming),
    streamError: chat.streaming?.error,
    maxAttachments,
    handleSaveNote,
  };
}
