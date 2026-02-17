const STATUS_READY = 'ready';
const IMAGE_ATTACHMENT_TYPE = 'image';

function createEmptyAttachmentResolution() {
  return {
    processedAttachments: [],
    linkedAssetIds: [],
    pendingAssetIds: [],
  };
}

function mapAssetResponse(asset, url) {
  return {
    id: asset.id,
    messageId: asset.message_id,
    type: asset.type,
    mimeType: asset.mime_type,
    fileName: asset.file_name,
    fileSize: asset.file_size,
    url,
    createdAt: asset.created_at,
    processingStatus: asset.processing_status,
    processingError: asset.processing_error,
  };
}

function mapAssetStatusResponse(asset) {
  return {
    id: asset.id,
    processingStatus: asset.processing_status,
    processingError: asset.processing_error,
    processingUpdatedAt: asset.processing_updated_at,
    processingCompletedAt: asset.processing_completed_at,
  };
}

function isAssetPending(asset) {
  return Boolean(asset.processing_status && asset.processing_status !== STATUS_READY);
}

function pushImageAttachment(resolved, visionData) {
  resolved.processedAttachments.push({
    type: IMAGE_ATTACHMENT_TYPE,
    mimeType: visionData.mimeType,
    base64: visionData.base64,
    fileName: visionData.fileName,
  });
}

module.exports = {
  createEmptyAttachmentResolution,
  mapAssetResponse,
  mapAssetStatusResponse,
  isAssetPending,
  pushImageAttachment,
};
