import type { ChatAttachment } from '../chat';
import type { PendingAttachment } from '../chat/components/AttachmentPreview';

const READY_STATUS = 'ready';
const ERROR_STATUS = 'error';
const ATTACHMENT_PROCESSING_TIMEOUT_MS = 60_000;
const ATTACHMENT_STATUS_POLL_INTERVAL_MS = 1_000;

type UploadChatAssetResponse = {
  id: string;
  processingStatus?: string | null;
  url?: string | null;
  type?: string | null;
  mimeType: string;
  fileName?: string | null;
};

type GetChatAssetStatusResponse = {
  processingStatus?: string | null;
  processingError?: string | null;
};

type UploadChatAssetFn = (params: {
  chatId: string;
  file: File;
}) => Promise<UploadChatAssetResponse>;

type GetChatAssetStatusFn = (params: { assetId: string }) => Promise<GetChatAssetStatusResponse>;

export type SetAttachmentStatusFn = (
  id: string,
  status: PendingAttachment['status'],
  assetId?: string,
  error?: string,
) => void;

type ProcessingAttachment = { assetId: string; attachmentId: string };
type ProcessingAttachmentStatus = {
  assetId: string;
  status: GetChatAssetStatusResponse;
};

function hasNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function resolveAttachmentKind(value: string | null | undefined): ChatAttachment['kind'] {
  if (value === 'image' || value === 'document' || value === 'code' || value === 'other') {
    return value;
  }
  return 'other';
}

function toMessageAttachment(
  asset: UploadChatAssetResponse,
  attachment: PendingAttachment,
): ChatAttachment {
  const attachmentUrl = hasNonEmptyString(asset.url) ? asset.url : attachment.previewUrl;
  const messageAttachment: ChatAttachment = {
    kind: resolveAttachmentKind(asset.type),
    mime: asset.mimeType,
    name: hasNonEmptyString(asset.fileName) ? asset.fileName : attachment.file.name,
  };
  if (attachmentUrl !== undefined && attachmentUrl.length > 0) {
    messageAttachment.url = attachmentUrl;
  }
  return messageAttachment;
}

export async function uploadAttachmentsForChat({
  chatId,
  pendingAttachments,
  uploadChatAsset,
  setAttachmentStatus,
}: {
  chatId: string;
  pendingAttachments: PendingAttachment[];
  uploadChatAsset: UploadChatAssetFn;
  setAttachmentStatus: SetAttachmentStatusFn;
}): Promise<{
  attachmentIds: string[];
  messageAttachments: ChatAttachment[];
  processingAttachments: ProcessingAttachment[];
}> {
  const attachmentIds: string[] = [];
  const messageAttachments: ChatAttachment[] = [];
  const processingAttachments: ProcessingAttachment[] = [];

  for (const attachment of pendingAttachments) {
    setAttachmentStatus(attachment.id, 'uploading');
    try {
      const asset = await uploadChatAsset({ chatId, file: attachment.file });
      attachmentIds.push(asset.id);
      const isProcessing =
        asset.processingStatus !== undefined && asset.processingStatus !== READY_STATUS;
      if (isProcessing) {
        setAttachmentStatus(attachment.id, 'processing', asset.id);
        processingAttachments.push({ assetId: asset.id, attachmentId: attachment.id });
      } else {
        setAttachmentStatus(attachment.id, 'uploaded', asset.id);
      }
      messageAttachments.push(toMessageAttachment(asset, attachment));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setAttachmentStatus(attachment.id, ERROR_STATUS, undefined, message);
      throw error;
    }
  }

  return { attachmentIds, messageAttachments, processingAttachments };
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureProcessingNotTimedOut(startedAt: number): void {
  if (Date.now() - startedAt > ATTACHMENT_PROCESSING_TIMEOUT_MS) {
    throw new Error('Attachment processing timed out.');
  }
}

async function fetchProcessingStatuses(
  remaining: Map<string, string>,
  getChatAssetStatus: GetChatAssetStatusFn,
): Promise<ProcessingAttachmentStatus[]> {
  const checkIds = Array.from(remaining.keys());
  return Promise.all(
    checkIds.map(async (assetId) => ({
      assetId,
      status: await getChatAssetStatus({ assetId }),
    })),
  );
}

function applyProcessingStatuses(
  statuses: ProcessingAttachmentStatus[],
  remaining: Map<string, string>,
  setAttachmentStatus: SetAttachmentStatusFn,
): void {
  for (const { assetId, status } of statuses) {
    const attachmentId = remaining.get(assetId);
    if (attachmentId === undefined) continue;

    if (status.processingStatus === READY_STATUS) {
      setAttachmentStatus(attachmentId, 'uploaded', assetId);
      remaining.delete(assetId);
      continue;
    }

    if (status.processingStatus === ERROR_STATUS) {
      const errorMessage = hasNonEmptyString(status.processingError)
        ? status.processingError
        : 'Attachment processing failed.';
      setAttachmentStatus(attachmentId, ERROR_STATUS, assetId, errorMessage);
      remaining.delete(assetId);
      throw new Error(errorMessage);
    }
  }
}

export async function waitForAttachmentProcessing({
  processingAttachments,
  getChatAssetStatus,
  setAttachmentStatus,
}: {
  processingAttachments: ProcessingAttachment[];
  getChatAssetStatus: GetChatAssetStatusFn;
  setAttachmentStatus: SetAttachmentStatusFn;
}): Promise<void> {
  const startedAt = Date.now();
  const remaining = new Map(
    processingAttachments.map(({ assetId, attachmentId }) => [assetId, attachmentId]),
  );

  while (remaining.size > 0) {
    ensureProcessingNotTimedOut(startedAt);

    const statuses = await fetchProcessingStatuses(remaining, getChatAssetStatus);
    applyProcessingStatuses(statuses, remaining, setAttachmentStatus);

    if (remaining.size > 0) {
      await wait(ATTACHMENT_STATUS_POLL_INTERVAL_MS);
    }
  }
}
