import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ApiClient, StreamErrorEvent } from '@api/client';
import { useChat, useChatAttachments, useChatInput, type ChatAttachment } from '../chat';
import { useNoteSaveContext } from '../contexts/NoteSaveContext';
import type { StorageAdapter } from './types';
import {
  uploadAttachmentsForChat,
  waitForAttachmentProcessing,
} from './chatSectionAttachmentHelpers';
import { sendChatSectionMessage } from './chatSectionSendMessage';
import {
  buildChatOptions,
  buildChatSectionViewModel,
  useSyncTextareaHeight,
} from './chatSectionModelUtils';

export const MAX_CHAT_ATTACHMENTS = 5;

type AttachmentPipelineItem = { assetId: string; attachmentId: string };

type ChatAttachmentApi = {
  uploadChatAsset?: ApiClient['uploadChatAsset'];
  getChatAssetStatus?: ApiClient['getChatAssetStatus'];
};

export interface ChatSectionProps {
  apiClient: ApiClient | null;
  storage?: StorageAdapter;
  pageUrl: string;
  courseCode: string | null;
  pendingPrefill?: string;
  onClearPrefill?: () => void;
  isOpen: boolean;
  isActive: boolean;
}

export interface ChatSectionViewModel {
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
}

function useAttachmentPipeline({
  apiClient,
  pendingAttachments,
  setAttachmentStatus,
}: {
  apiClient: ChatAttachmentApi | null;
  pendingAttachments: ReturnType<typeof useChatAttachments>['attachments'];
  setAttachmentStatus: ReturnType<typeof useChatAttachments>['setAttachmentStatus'];
}): {
  uploadAttachments: (chatId: string) => Promise<{
    attachmentIds: string[];
    messageAttachments: ChatAttachment[];
    processingAttachments: AttachmentPipelineItem[];
  }>;
  waitForAttachmentsReady: (items: AttachmentPipelineItem[]) => Promise<void>;
} {
  const uploadAttachments = useCallback(
    async (chatId: string) => {
      const uploadChatAsset = apiClient?.uploadChatAsset;
      if (uploadChatAsset === undefined) throw new Error('Attachment uploads are not available.');
      return uploadAttachmentsForChat({
        chatId,
        pendingAttachments,
        uploadChatAsset,
        setAttachmentStatus,
      });
    },
    [apiClient, pendingAttachments, setAttachmentStatus],
  );

  const waitForAttachmentsReady = useCallback(
    async (processingAttachments: AttachmentPipelineItem[]) => {
      const getChatAssetStatus = apiClient?.getChatAssetStatus;
      if (getChatAssetStatus === undefined) {
        throw new Error('Attachment status checks are not available.');
      }
      await waitForAttachmentProcessing({
        processingAttachments,
        getChatAssetStatus,
        setAttachmentStatus,
      });
    },
    [apiClient, setAttachmentStatus],
  );

  return { uploadAttachments, waitForAttachmentsReady };
}

function useComposerSendState({
  chat,
  attachmentState,
  uploadAttachments,
  waitForAttachmentsReady,
}: {
  chat: ReturnType<typeof useChat>;
  attachmentState: ReturnType<typeof useChatAttachments>;
  uploadAttachments: (chatId: string) => Promise<{
    attachmentIds: string[];
    messageAttachments: ChatAttachment[];
    processingAttachments: AttachmentPipelineItem[];
  }>;
  waitForAttachmentsReady: (items: AttachmentPipelineItem[]) => Promise<void>;
}): {
  composerError: string | null;
  setComposerError: (value: string | null) => void;
  safetyWarning: string | null;
  prefillSourceRef: MutableRefObject<boolean>;
  handleSendMessage: (value: string) => Promise<boolean>;
  dismissSafetyWarning: () => void;
} {
  const safetyState = useComposerSafetyState();
  const prefillSourceRef = useRef(false);
  const hasPendingAttachments = attachmentState.attachments.length > 0;
  const handleSendMessage = useSendMessageHandler({
    chat,
    attachmentState,
    safetyState,
    uploadAttachments,
    waitForAttachmentsReady,
    prefillSourceRef,
    hasPendingAttachments,
  });
  return {
    composerError: safetyState.composerError,
    setComposerError: safetyState.setComposerError,
    safetyWarning: safetyState.safetyWarning,
    prefillSourceRef,
    handleSendMessage,
    dismissSafetyWarning: safetyState.dismissSafetyWarning,
  };
}

function useComposerSafetyState(): {
  composerError: string | null;
  setComposerError: (value: string | null) => void;
  safetyWarning: string | null;
  setSafetyWarning: (value: string | null) => void;
  setSafetyBypass: (value: boolean) => void;
  safetyBypass: boolean;
  dismissSafetyWarning: () => void;
} {
  const [composerError, setComposerError] = useState<string | null>(null);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [safetyBypass, setSafetyBypass] = useState(false);
  const dismissSafetyWarning = useCallback(() => {
    setSafetyBypass(true);
    setSafetyWarning(null);
  }, []);
  return {
    composerError,
    setComposerError,
    safetyWarning,
    setSafetyWarning,
    setSafetyBypass,
    safetyBypass,
    dismissSafetyWarning,
  };
}

function useSendMessageHandler({
  chat,
  attachmentState,
  safetyState,
  uploadAttachments,
  waitForAttachmentsReady,
  prefillSourceRef,
  hasPendingAttachments,
}: {
  chat: ReturnType<typeof useChat>;
  attachmentState: ReturnType<typeof useChatAttachments>;
  safetyState: ReturnType<typeof useComposerSafetyState>;
  uploadAttachments: (chatId: string) => Promise<{
    attachmentIds: string[];
    messageAttachments: ChatAttachment[];
    processingAttachments: AttachmentPipelineItem[];
  }>;
  waitForAttachmentsReady: (items: AttachmentPipelineItem[]) => Promise<void>;
  prefillSourceRef: MutableRefObject<boolean>;
  hasPendingAttachments: boolean;
}): (value: string) => Promise<boolean> {
  return useCallback(
    async (value: string) =>
      sendChatSectionMessage({
        value,
        hasPendingAttachments,
        isSending: chat.isSending,
        isAttachmentUploading: attachmentState.isUploading,
        safetyBypass: safetyState.safetyBypass,
        setComposerError: safetyState.setComposerError,
        setSafetyWarning: safetyState.setSafetyWarning,
        setSafetyBypass: safetyState.setSafetyBypass,
        ensureChatId: chat.ensureChatId,
        uploadAttachments,
        waitForAttachmentsReady,
        prefillSourceRef,
        sendMessage: chat.sendMessage,
        clearAttachments: attachmentState.clearAttachments,
      }),
    [
      chat,
      attachmentState,
      safetyState,
      uploadAttachments,
      waitForAttachmentsReady,
      prefillSourceRef,
      hasPendingAttachments,
    ],
  );
}

function usePendingPrefill({
  pendingPrefill,
  setValue,
  inputRef,
  isOpen,
  isActive,
  onClearPrefill,
  prefillSourceRef,
}: {
  pendingPrefill?: string | undefined;
  setValue: (value: string) => void;
  inputRef: ReturnType<typeof useChatInput>['inputRef'];
  isOpen: boolean;
  isActive: boolean;
  onClearPrefill?: (() => void) | undefined;
  prefillSourceRef: MutableRefObject<boolean>;
}): void {
  useEffect(() => {
    if (pendingPrefill === undefined || pendingPrefill.trim().length === 0) return;
    prefillSourceRef.current = true;
    setValue(pendingPrefill);
    if (isOpen && isActive) requestAnimationFrame(() => inputRef.current?.focus());
    onClearPrefill?.();
  }, [pendingPrefill, setValue, inputRef, isOpen, isActive, onClearPrefill, prefillSourceRef]);
}

function useSaveNoteHandler(): (content: string) => void {
  const { saveNote } = useNoteSaveContext();
  return useCallback(
    (content: string) => void saveNote({ content, noteType: 'manual' }),
    [saveNote],
  );
}

export function useChatSectionModel(props: ChatSectionProps): ChatSectionViewModel {
  const chat = useChat(buildChatOptions(props));
  const attachmentState = useChatAttachments({ maxAttachments: MAX_CHAT_ATTACHMENTS });
  const hasPendingAttachments = attachmentState.attachments.length > 0;
  const { uploadAttachments, waitForAttachmentsReady } = useAttachmentPipeline({
    apiClient: props.apiClient,
    pendingAttachments: attachmentState.attachments,
    setAttachmentStatus: attachmentState.setAttachmentStatus,
  });
  const composerState = useComposerSendState({
    chat,
    attachmentState,
    uploadAttachments,
    waitForAttachmentsReady,
  });
  const inputState = useChatInput({
    onSend: composerState.handleSendMessage,
    isSending: chat.isSending || attachmentState.isUploading,
    shouldFocus: props.isOpen && props.isActive,
    canSend: hasPendingAttachments,
  });
  const handleSaveNote = useSaveNoteHandler();

  usePendingPrefill({
    pendingPrefill: props.pendingPrefill,
    setValue: inputState.setValue,
    inputRef: inputState.inputRef,
    isOpen: props.isOpen,
    isActive: props.isActive,
    onClearPrefill: props.onClearPrefill,
    prefillSourceRef: composerState.prefillSourceRef,
  });
  useSyncTextareaHeight({
    isOpen: props.isOpen,
    isActive: props.isActive,
    inputValue: inputState.value,
    syncTextareaHeight: inputState.syncHeight,
  });

  return buildChatSectionViewModel({
    chat,
    attachmentState,
    inputState,
    composerState,
    hasPendingAttachments,
    handleSaveNote,
    maxAttachments: MAX_CHAT_ATTACHMENTS,
  });
}
