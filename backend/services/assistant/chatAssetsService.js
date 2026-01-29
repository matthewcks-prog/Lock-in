const { randomUUID } = require('crypto');
const pdfParse = require('pdf-parse');
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
const { validateUUID } = require('../../utils/validation');
const { checkChatAssetDailyLimits } = require('../rateLimitService');

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
    });

    const url = await createSignedAssetUrl(storagePath);

    return {
      id: asset.id,
      type: asset.type,
      mimeType: asset.mime_type,
      fileName: asset.file_name,
      fileSize: asset.file_size,
      url,
      createdAt: asset.created_at,
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
      })),
    );
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

  async function getAssetForVision(assetId, userId) {
    const asset = await services.chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) return null;

    const { data, error } = await services.storageRepository.download(asset.storage_path);
    if (error) {
      services.logger.error({ err: error }, 'Failed to download asset for vision');
      return null;
    }

    const buffer = await data.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      id: asset.id,
      type: asset.type,
      mimeType: asset.mime_type,
      base64,
      fileName: asset.file_name,
    };
  }

  async function getAssetTextContent(assetId, userId) {
    const asset = await services.chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) return null;

    const { data, error } = await services.storageRepository.download(asset.storage_path);
    if (error) {
      services.logger.error({ err: error }, 'Failed to download asset for text extraction');
      return null;
    }

    const buffer = await data.arrayBuffer();
    let textContent = '';

    if (asset.mime_type === 'application/pdf') {
      try {
        const parsed = await pdfParse(Buffer.from(buffer));
        textContent = parsed.text?.trim() || '';
        if (!textContent) {
          textContent = '[PDF text extraction returned empty]';
        }
      } catch (error) {
        services.logger.error({ err: error }, 'Failed to extract PDF content');
        textContent = '[PDF text extraction failed]';
      }
    } else if (asset.mime_type.startsWith('text/') || asset.mime_type === 'application/json') {
      textContent = Buffer.from(buffer).toString('utf-8');
    } else {
      textContent = '[Binary file - content not extractable]';
    }

    return {
      id: asset.id,
      type: asset.type,
      mimeType: asset.mime_type,
      textContent,
      fileName: asset.file_name,
    };
  }

  async function resolveAttachmentsForMessage({ userId, assetIds } = {}) {
    const processedAttachments = [];
    const linkedAssetIds = [];

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return { processedAttachments, linkedAssetIds };
    }

    for (const assetId of assetIds.slice(0, 5)) {
      const assetIdValidation = validateUUID(assetId);
      if (!assetIdValidation.valid) continue;

      const asset = await services.chatAssetsRepository.getAssetById(assetId, userId);
      if (!asset) continue;
      linkedAssetIds.push(asset.id);

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

    return { processedAttachments, linkedAssetIds };
  }

  async function linkAssetsToMessage(assetIds, messageId, userId) {
    if (!assetIds || assetIds.length === 0) return;
    await services.chatAssetsRepository.linkAssetsToMessage(assetIds, messageId, userId);
  }

  return {
    createSignedAssetUrl,
    uploadChatAsset,
    listChatAssets,
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
