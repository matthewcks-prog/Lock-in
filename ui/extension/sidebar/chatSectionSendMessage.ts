import type { MutableRefObject } from 'react';
import type { ChatAttachment } from '../chat';
import { scanContent } from '@core/services/contentSafetyFilter';

type AttachmentProcessingItem = { assetId: string; attachmentId: string };

type UploadAttachmentsFn = (chatId: string) => Promise<{
  attachmentIds: string[];
  messageAttachments: ChatAttachment[];
  processingAttachments: AttachmentProcessingItem[];
}>;

type WaitForAttachmentsReadyFn = (
  processingAttachments: AttachmentProcessingItem[],
) => Promise<void>;

type SendMessageFn = (
  message: string,
  options: {
    source: 'selection' | 'followup';
    attachments: ChatAttachment[];
    attachmentIds: string[];
    selectionOverride?: string;
    userMessageOverride?: string;
  },
) => void;

type SetStringState = (value: string | null) => void;
type SetBooleanState = (value: boolean) => void;
type SendChatSectionMessageParams = {
  value: string;
  hasPendingAttachments: boolean;
  isSending: boolean;
  isAttachmentUploading: boolean;
  safetyBypass: boolean;
  setComposerError: SetStringState;
  setSafetyWarning: SetStringState;
  setSafetyBypass: SetBooleanState;
  ensureChatId: (seedMessage: string) => Promise<string | null>;
  uploadAttachments: UploadAttachmentsFn;
  waitForAttachmentsReady: WaitForAttachmentsReadyFn;
  prefillSourceRef: MutableRefObject<boolean>;
  sendMessage: SendMessageFn;
  clearAttachments: () => void;
};

function canSend({
  hasText,
  hasAttachments,
  isSending,
  isAttachmentUploading,
}: {
  hasText: boolean;
  hasAttachments: boolean;
  isSending: boolean;
  isAttachmentUploading: boolean;
}): boolean {
  return (hasText || hasAttachments) && !isSending && !isAttachmentUploading;
}

function passSafetyCheck({
  trimmed,
  hasText,
  safetyBypass,
  setSafetyWarning,
  setSafetyBypass,
}: {
  trimmed: string;
  hasText: boolean;
  safetyBypass: boolean;
  setSafetyWarning: SetStringState;
  setSafetyBypass: SetBooleanState;
}): boolean {
  if (!hasText || safetyBypass) {
    setSafetyWarning(null);
    setSafetyBypass(false);
    return true;
  }

  const safetyResult = scanContent(trimmed);
  if (safetyResult.hasSensitiveContent) {
    setSafetyWarning(safetyResult.summary);
    return false;
  }
  setSafetyWarning(null);
  setSafetyBypass(false);
  return true;
}

async function resolveAttachmentPayload({
  hasAttachments,
  hasText,
  trimmed,
  ensureChatId,
  uploadAttachments,
  waitForAttachmentsReady,
}: {
  hasAttachments: boolean;
  hasText: boolean;
  trimmed: string;
  ensureChatId: (seedMessage: string) => Promise<string | null>;
  uploadAttachments: UploadAttachmentsFn;
  waitForAttachmentsReady: WaitForAttachmentsReadyFn;
}): Promise<{ attachmentIds: string[]; messageAttachments: ChatAttachment[] }> {
  if (!hasAttachments) {
    return { attachmentIds: [], messageAttachments: [] };
  }

  const chatId = await ensureChatId(hasText ? trimmed : 'Attachment-based question');
  if (chatId === null || chatId.length === 0) {
    throw new Error('Unable to create a chat session for attachments.');
  }

  const uploadResult = await uploadAttachments(chatId);
  if (uploadResult.processingAttachments.length > 0) {
    await waitForAttachmentsReady(uploadResult.processingAttachments);
  }
  return {
    attachmentIds: uploadResult.attachmentIds,
    messageAttachments: uploadResult.messageAttachments,
  };
}

function dispatchMessage({
  trimmed,
  hasText,
  attachmentIds,
  messageAttachments,
  prefillSourceRef,
  sendMessage,
}: {
  trimmed: string;
  hasText: boolean;
  attachmentIds: string[];
  messageAttachments: ChatAttachment[];
  prefillSourceRef: MutableRefObject<boolean>;
  sendMessage: SendMessageFn;
}): void {
  const displayMessage = hasText ? trimmed : 'Sent attachments';
  const source = prefillSourceRef.current && hasText ? 'selection' : 'followup';
  prefillSourceRef.current = false;

  const sendOptions: Parameters<SendMessageFn>[1] = {
    source,
    attachments: messageAttachments,
    attachmentIds,
  };
  if (!hasText) {
    sendOptions.selectionOverride = '';
  } else {
    sendOptions.userMessageOverride = trimmed;
  }
  sendMessage(displayMessage, sendOptions);
}

function prepareSendContext(
  params: Pick<SendChatSectionMessageParams, 'value' | 'hasPendingAttachments'>,
): {
  trimmed: string;
  hasText: boolean;
  hasAttachments: boolean;
} {
  const trimmed = params.value.trim();
  return {
    trimmed,
    hasText: trimmed.length > 0,
    hasAttachments: params.hasPendingAttachments,
  };
}

function canProceedSend({
  hasText,
  hasAttachments,
  isSending,
  isAttachmentUploading,
}: {
  hasText: boolean;
  hasAttachments: boolean;
  isSending: boolean;
  isAttachmentUploading: boolean;
}): boolean {
  return canSend({ hasText, hasAttachments, isSending, isAttachmentUploading });
}

export async function sendChatSectionMessage(
  params: SendChatSectionMessageParams,
): Promise<boolean> {
  const {
    value,
    hasPendingAttachments,
    isSending,
    isAttachmentUploading,
    safetyBypass,
    setComposerError,
    setSafetyWarning,
    setSafetyBypass,
    ensureChatId,
    uploadAttachments,
    waitForAttachmentsReady,
    prefillSourceRef,
    sendMessage,
    clearAttachments,
  } = params;
  const { trimmed, hasText, hasAttachments } = prepareSendContext({ value, hasPendingAttachments });
  if (!canProceedSend({ hasText, hasAttachments, isSending, isAttachmentUploading })) return false;
  setComposerError(null);
  if (!passSafetyCheck({ trimmed, hasText, safetyBypass, setSafetyWarning, setSafetyBypass }))
    return false;

  try {
    const { attachmentIds, messageAttachments } = await resolveAttachmentPayload({
      hasAttachments,
      hasText,
      trimmed,
      ensureChatId,
      uploadAttachments,
      waitForAttachmentsReady,
    });
    dispatchMessage({
      trimmed,
      hasText,
      attachmentIds,
      messageAttachments,
      prefillSourceRef,
      sendMessage,
    });
    clearAttachments();
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload attachments.';
    setComposerError(message);
    return false;
  }
}
