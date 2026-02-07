const { randomUUID } = require('crypto');
const { setImmediate } = require('timers');
const { logger: baseLogger } = require('../../observability');
const {
  CHAT_ASSETS_BUCKET,
  CHAT_ASSET_DAILY_UPLOAD_LIMIT,
  CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
  CHAT_ASSET_SIGNED_URL_TTL_SECONDS,
} = require('../../config');
const { createStorageRepository } = require('../../repositories/storageRepository');
const chatAssetsRepository = require('../../repositories/chatAssetsRepository');
const chatRepository = require('../../repositories/chatRepository');
const {
  validateChatAssetFile,
  isVisionCompatibleImage,
} = require('../../utils/chatAssetValidation');
const { checkChatAssetDailyLimits } = require('../rateLimitService');
const { createChatAssetContentService } = require('./chatAssetContentService');

function createRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.payload = { error: message };
  return error;
}

function createChatAssetsService(deps = {}) {
  const bucket = deps.bucket ?? CHAT_ASSETS_BUCKET;
  const storageRepository =
    deps.storageRepository ??
    createStorageRepository({
      bucket,
      supabaseClient: deps.supabase,
    });

  const services = {
    chatRepository: deps.chatRepository ?? chatRepository,
    chatAssetsRepository: deps.chatAssetsRepository ?? chatAssetsRepository,
    rateLimitService: deps.rateLimitService ?? { checkChatAssetDailyLimits },
    storageRepository,
    logger: deps.logger ?? baseLogger,
    bucket,
    dailyUploadLimit: deps.dailyUploadLimit ?? CHAT_ASSET_DAILY_UPLOAD_LIMIT,
    dailyUploadBytesLimit: deps.dailyUploadBytesLimit ?? CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
    signedUrlTtl: deps.signedUrlTtl ?? CHAT_ASSET_SIGNED_URL_TTL_SECONDS,
  };

  const { getAssetForVision, getAssetTextContent } = createChatAssetContentService(services);
  const maxProcessedChars = deps.maxProcessedChars ?? 40000;

  function truncateText(text) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxProcessedChars) return text;
    return text.slice(0, maxProcessedChars);
  }

  async function createSignedAssetUrl(storagePath) {
    const { data, error } = await services.storageRepository.createSignedUrl(
      storagePath,
      services.signedUrlTtl,
    );

    if (error) {
      services.logger.warn({ err: error }, 'Failed to create signed asset URL');
      return null;
    }

    return data?.signedUrl || null;
  }

  async function ensureChatExists(userId, chatId) {
    const chat = await services.chatRepository.getChatById(userId, chatId);
    if (!chat) {
      throw createRequestError(404, 'Chat not found');
    }
    return chat;
  }

  async function uploadChatAsset({ userId, chatId, file } = {}) {
    if (!userId) {
      throw createRequestError(500, 'User context missing.');
    }
    if (!chatId) {
      throw createRequestError(400, 'Chat ID is required');
    }

    await ensureChatExists(userId, chatId);

    const validation = await validateChatAssetFile(file);
    if (!validation.valid) {
      throw createRequestError(400, validation.reason || 'Invalid file');
    }

    const usage = await services.rateLimitService.checkChatAssetDailyLimits(userId, {
      maxUploadsPerDay: services.dailyUploadLimit,
      maxBytesPerDay: services.dailyUploadBytesLimit,
    });

    if (!usage.allowed || usage.remainingUploads < 1 || usage.remainingBytes < file.size) {
      throw createRequestError(429, 'Daily upload limit reached');
    }

    const assetId = randomUUID();
    const storagePath = `${userId}/${chatId}/${assetId}.${validation.extension}`;

    const { error: uploadError } = await services.storageRepository.upload(
      storagePath,
      file.buffer,
      {
        contentType: validation.mimeType,
        upsert: false,
      },
    );

    if (uploadError) {
      services.logger.error({ err: uploadError }, 'Failed to upload chat asset to storage');
      throw createRequestError(500, 'Failed to upload file');
    }

    const asset = await services.chatAssetsRepository.createAsset({
      id: assetId,
      messageId: null,
      userId,
      type: validation.type,
      mimeType: validation.mimeType,
      storagePath,
      fileName: file.originalname || null,
      fileSize: file.size || null,
      processingStatus: isVisionCompatibleImage(validation.mimeType) ? 'ready' : 'pending',
    });

    if (!isVisionCompatibleImage(validation.mimeType)) {
      setImmediate(() => {
        processAssetInBackground({ assetId: asset.id, userId }).catch((error) => {
          services.logger.warn({ err: error }, 'Failed to process chat asset in background');
        });
      });
    }

    const url = await createSignedAssetUrl(storagePath);

    return {
      id: asset.id,
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

  async function listChatAssets({ userId, chatId } = {}) {
    if (!userId) {
      throw createRequestError(500, 'User context missing.');
    }
    if (!chatId) {
      throw createRequestError(400, 'Chat ID is required');
    }

    await ensureChatExists(userId, chatId);

    const assets = await services.chatAssetsRepository.listAssetsForChat(chatId, userId);

    return Promise.all(
      assets.map(async (asset) => ({
        id: asset.id,
        messageId: asset.message_id,
        type: asset.type,
        mimeType: asset.mime_type,
        fileName: asset.file_name,
        fileSize: asset.file_size,
        url: await createSignedAssetUrl(asset.storage_path),
        createdAt: asset.created_at,
        processingStatus: asset.processing_status,
        processingError: asset.processing_error,
      })),
    );
  }

  async function getChatAssetStatus({ userId, assetId } = {}) {
    if (!userId) {
      throw createRequestError(500, 'User context missing.');
    }
    if (!assetId) {
      throw createRequestError(400, 'Asset ID is required');
    }

    const asset = await services.chatAssetsRepository.getAssetProcessingStatus(assetId, userId);
    if (!asset) {
      throw createRequestError(404, 'Asset not found');
    }

    return {
      id: asset.id,
      processingStatus: asset.processing_status,
      processingError: asset.processing_error,
      processingUpdatedAt: asset.processing_updated_at,
      processingCompletedAt: asset.processing_completed_at,
    };
  }

  async function deleteChatAsset({ userId, assetId } = {}) {
    if (!userId) {
      throw createRequestError(500, 'User context missing.');
    }
    if (!assetId) {
      throw createRequestError(400, 'Asset ID is required');
    }

    const asset = await services.chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) {
      throw createRequestError(404, 'Asset not found');
    }

    const { error: storageError } = await services.storageRepository.remove([asset.storage_path]);
    if (storageError) {
      services.logger.error({ err: storageError }, 'Failed to delete chat asset from storage');
      throw createRequestError(500, 'Failed to delete asset');
    }

    await services.chatAssetsRepository.deleteAsset(assetId, userId);
  }

  async function resolveAttachmentsForMessage({ userId, assetIds } = {}) {
    const processedAttachments = [];
    const linkedAssetIds = [];
    const pendingAssetIds = [];

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return { processedAttachments, linkedAssetIds, pendingAssetIds };
    }

    for (const assetId of assetIds.slice(0, 5)) {
      const asset = await services.chatAssetsRepository.getAssetById(assetId, userId);
      if (!asset) continue;
      linkedAssetIds.push(asset.id);

      if (asset.processing_status && asset.processing_status !== 'ready') {
        pendingAssetIds.push(asset.id);
        continue;
      }

      if (isVisionCompatibleImage(asset.mime_type)) {
        const visionData = await getAssetForVision(assetId, userId);
        if (visionData) {
          processedAttachments.push({
            type: 'image',
            mimeType: visionData.mimeType,
            base64: visionData.base64,
            fileName: visionData.fileName,
          });
        }
        continue;
      }

      if (asset.processed_text) {
        processedAttachments.push({
          type: asset.type,
          mimeType: asset.mime_type,
          textContent: asset.processed_text,
          fileName: asset.file_name,
        });
        continue;
      }

      const textData = await getAssetTextContent(assetId, userId);
      if (textData && textData.textContent) {
        processedAttachments.push({
          type: asset.type,
          mimeType: textData.mimeType,
          textContent: textData.textContent,
          fileName: textData.fileName,
        });
      }
    }

    return { processedAttachments, linkedAssetIds, pendingAssetIds };
  }

  async function processAssetInBackground({ assetId, userId } = {}) {
    if (!assetId || !userId) return;

    await services.chatAssetsRepository.updateAssetProcessing({
      assetId,
      userId,
      updates: {
        processing_status: 'processing',
        processing_started_at: new Date().toISOString(),
        processing_updated_at: new Date().toISOString(),
        processing_error: null,
      },
    });

    try {
      const textData = await getAssetTextContent(assetId, userId);
      if (!textData || !textData.textContent) {
        await services.chatAssetsRepository.updateAssetProcessing({
          assetId,
          userId,
          updates: {
            processing_status: 'error',
            processing_error: 'No extractable text found',
            processing_updated_at: new Date().toISOString(),
          },
        });
        return;
      }

      await services.chatAssetsRepository.updateAssetProcessing({
        assetId,
        userId,
        updates: {
          processing_status: 'ready',
          processed_text: truncateText(textData.textContent),
          processing_error: null,
          processing_updated_at: new Date().toISOString(),
          processing_completed_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      await services.chatAssetsRepository.updateAssetProcessing({
        assetId,
        userId,
        updates: {
          processing_status: 'error',
          processing_error: error instanceof Error ? error.message : 'Processing failed',
          processing_updated_at: new Date().toISOString(),
        },
      });
      throw error;
    }
  }

  async function linkAssetsToMessage(assetIds, messageId, userId) {
    if (!assetIds || assetIds.length === 0) return;
    await services.chatAssetsRepository.linkAssetsToMessage(assetIds, messageId, userId);
  }

  return {
    createSignedAssetUrl,
    uploadChatAsset,
    listChatAssets,
    getChatAssetStatus,
    deleteChatAsset,
    getAssetForVision,
    getAssetTextContent,
    resolveAttachmentsForMessage,
    linkAssetsToMessage,
  };
}

const chatAssetsService = createChatAssetsService();

module.exports = {
  createChatAssetsService,
  chatAssetsService,
};
