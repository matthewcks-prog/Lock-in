const { randomUUID } = require('crypto');
const { setImmediate } = require('timers');
const {
  validateChatAssetFile,
  isVisionCompatibleImage,
} = require('../../utils/chatAssetValidation');
const { processAssetInBackground } = require('./chatAssetProcessing');
const {
  createEmptyAttachmentResolution,
  mapAssetResponse,
  mapAssetStatusResponse,
  isAssetPending,
  pushImageAttachment,
} = require('./chatAssetMappers');

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const DEFAULT_MAX_PROCESSED_CHARS = 40000;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const STATUS_READY = 'ready';
const STATUS_PENDING = 'pending';

function createRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.payload = { error: message };
  return error;
}

function requireUserContext(userId) {
  if (!userId) {
    throw createRequestError(HTTP_STATUS_INTERNAL_SERVER_ERROR, 'User context missing.');
  }
}

function requireChatId(chatId) {
  if (!chatId) {
    throw createRequestError(HTTP_STATUS_BAD_REQUEST, 'Chat ID is required');
  }
}

function requireAssetId(assetId) {
  if (!assetId) {
    throw createRequestError(HTTP_STATUS_BAD_REQUEST, 'Asset ID is required');
  }
}

async function createSignedAssetUrl(context, storagePath) {
  const { data, error } = await context.services.storageRepository.createSignedUrl(
    storagePath,
    context.services.signedUrlTtl,
  );
  if (error) {
    context.services.logger.warn({ err: error }, 'Failed to create signed asset URL');
    return null;
  }
  return data?.signedUrl || null;
}

async function ensureChatExists(context, userId, chatId) {
  const chat = await context.services.chatRepository.getChatById(userId, chatId);
  if (!chat) {
    throw createRequestError(HTTP_STATUS_NOT_FOUND, 'Chat not found');
  }
  return chat;
}

async function ensureUploadAllowance(context, userId, file) {
  const usage = await context.services.rateLimitService.checkChatAssetDailyLimits(userId, {
    maxUploadsPerDay: context.services.dailyUploadLimit,
    maxBytesPerDay: context.services.dailyUploadBytesLimit,
  });
  const hasQuota =
    usage.allowed && usage.remainingUploads >= 1 && usage.remainingBytes >= file.size;
  if (!hasQuota) {
    throw createRequestError(HTTP_STATUS_TOO_MANY_REQUESTS, 'Daily upload limit reached');
  }
}

async function uploadFileToStorage(context, storagePath, file, validation) {
  const { error: uploadError } = await context.services.storageRepository.upload(
    storagePath,
    file.buffer,
    {
      contentType: validation.mimeType,
      upsert: false,
    },
  );
  if (uploadError) {
    context.services.logger.error({ err: uploadError }, 'Failed to upload chat asset to storage');
    throw createRequestError(HTTP_STATUS_INTERNAL_SERVER_ERROR, 'Failed to upload file');
  }
}

async function createStoredAsset(context, { assetId, userId, file, validation, storagePath }) {
  return context.services.chatAssetsRepository.createAsset({
    id: assetId,
    messageId: null,
    userId,
    type: validation.type,
    mimeType: validation.mimeType,
    storagePath,
    fileName: file.originalname || null,
    fileSize: file.size || null,
    processingStatus: isVisionCompatibleImage(validation.mimeType) ? STATUS_READY : STATUS_PENDING,
  });
}

function scheduleBackgroundProcessing(context, { assetId, userId, mimeType }) {
  if (isVisionCompatibleImage(mimeType)) {
    return;
  }

  setImmediate(() => {
    processAssetInBackground(context, { assetId, userId }).catch((error) => {
      context.services.logger.warn({ err: error }, 'Failed to process chat asset in background');
    });
  });
}

async function uploadChatAsset(context, { userId, chatId, file } = {}) {
  requireUserContext(userId);
  requireChatId(chatId);
  await ensureChatExists(context, userId, chatId);

  const validation = await validateChatAssetFile(file);
  if (!validation.valid) {
    throw createRequestError(HTTP_STATUS_BAD_REQUEST, validation.reason || 'Invalid file');
  }

  await ensureUploadAllowance(context, userId, file);

  const assetId = randomUUID();
  const storagePath = `${userId}/${chatId}/${assetId}.${validation.extension}`;
  await uploadFileToStorage(context, storagePath, file, validation);

  const asset = await createStoredAsset(context, {
    assetId,
    userId,
    file,
    validation,
    storagePath,
  });
  scheduleBackgroundProcessing(context, {
    assetId: asset.id,
    userId,
    mimeType: validation.mimeType,
  });

  const url = await createSignedAssetUrl(context, storagePath);
  return mapAssetResponse(asset, url);
}

async function listChatAssets(context, { userId, chatId } = {}) {
  requireUserContext(userId);
  requireChatId(chatId);
  await ensureChatExists(context, userId, chatId);

  const assets = await context.services.chatAssetsRepository.listAssetsForChat(chatId, userId);
  return Promise.all(
    assets.map(async (asset) => {
      const url = await createSignedAssetUrl(context, asset.storage_path);
      return mapAssetResponse(asset, url);
    }),
  );
}

async function getChatAssetStatus(context, { userId, assetId } = {}) {
  requireUserContext(userId);
  requireAssetId(assetId);

  const asset = await context.services.chatAssetsRepository.getAssetProcessingStatus(
    assetId,
    userId,
  );
  if (!asset) {
    throw createRequestError(HTTP_STATUS_NOT_FOUND, 'Asset not found');
  }
  return mapAssetStatusResponse(asset);
}

async function deleteChatAsset(context, { userId, assetId } = {}) {
  requireUserContext(userId);
  requireAssetId(assetId);

  const asset = await context.services.chatAssetsRepository.getAssetById(assetId, userId);
  if (!asset) {
    throw createRequestError(HTTP_STATUS_NOT_FOUND, 'Asset not found');
  }

  const { error: storageError } = await context.services.storageRepository.remove([
    asset.storage_path,
  ]);
  if (storageError) {
    context.services.logger.error(
      { err: storageError },
      'Failed to delete chat asset from storage',
    );
    throw createRequestError(HTTP_STATUS_INTERNAL_SERVER_ERROR, 'Failed to delete asset');
  }

  await context.services.chatAssetsRepository.deleteAsset(assetId, userId);
}

async function addResolvedAttachmentContent(context, resolved, asset, userId) {
  if (isVisionCompatibleImage(asset.mime_type)) {
    const visionData = await context.getAssetForVision(asset.id, userId);
    if (visionData) {
      pushImageAttachment(resolved, visionData);
    }
    return;
  }

  if (asset.processed_text) {
    resolved.processedAttachments.push({
      type: asset.type,
      mimeType: asset.mime_type,
      textContent: asset.processed_text,
      fileName: asset.file_name,
    });
    return;
  }

  const textData = await context.getAssetTextContent(asset.id, userId);
  if (textData?.textContent) {
    resolved.processedAttachments.push({
      type: asset.type,
      mimeType: textData.mimeType,
      textContent: textData.textContent,
      fileName: textData.fileName,
    });
  }
}

async function resolveAttachmentsForMessage(context, { userId, assetIds } = {}) {
  const resolved = createEmptyAttachmentResolution();
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return resolved;
  }

  const limitedAssetIds = assetIds.slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  for (const assetId of limitedAssetIds) {
    const asset = await context.services.chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) {
      continue;
    }

    resolved.linkedAssetIds.push(asset.id);
    if (isAssetPending(asset)) {
      resolved.pendingAssetIds.push(asset.id);
      continue;
    }

    await addResolvedAttachmentContent(context, resolved, asset, userId);
  }

  return resolved;
}

async function linkAssetsToMessage(context, assetIds, messageId, userId) {
  if (!assetIds || assetIds.length === 0) {
    return;
  }
  await context.services.chatAssetsRepository.linkAssetsToMessage(assetIds, messageId, userId);
}

function createChatAssetsOperations(context) {
  return {
    createSignedAssetUrl: (storagePath) => createSignedAssetUrl(context, storagePath),
    uploadChatAsset: (params) => uploadChatAsset(context, params),
    listChatAssets: (params) => listChatAssets(context, params),
    getChatAssetStatus: (params) => getChatAssetStatus(context, params),
    deleteChatAsset: (params) => deleteChatAsset(context, params),
    resolveAttachmentsForMessage: (params) => resolveAttachmentsForMessage(context, params),
    processAssetInBackground: (params) => processAssetInBackground(context, params),
    linkAssetsToMessage: (assetIds, messageId, userId) =>
      linkAssetsToMessage(context, assetIds, messageId, userId),
  };
}

module.exports = {
  createChatAssetsOperations,
  createRequestError,
  DEFAULT_MAX_PROCESSED_CHARS,
};
