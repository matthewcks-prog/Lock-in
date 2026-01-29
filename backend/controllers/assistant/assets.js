/**
 * Chat Assets Controller
 *
 * Handles file upload, listing, and deletion for chat message attachments.
 * Mirrors the pattern from notes/assets.js
 */

const { randomUUID } = require('crypto');
const { supabase } = require('../../supabaseClient');
const {
  CHAT_ASSETS_BUCKET,
  CHAT_ASSET_DAILY_UPLOAD_LIMIT,
  CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
  CHAT_ASSET_SIGNED_URL_TTL_SECONDS,
} = require('../../config');
const chatAssetsRepository = require('../../repositories/chatAssetsRepository');
const { getChatById } = require('../../chatRepository');
const { validateChatAssetFile } = require('../../utils/chatAssetValidation');
const { checkChatAssetDailyLimits } = require('../../rateLimiter');

async function createSignedAssetUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(CHAT_ASSETS_BUCKET)
    .createSignedUrl(storagePath, CHAT_ASSET_SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.warn('Failed to create signed asset URL:', error);
    return null;
  }

  return data?.signedUrl || null;
}

/**
 * POST /api/chats/:chatId/assets
 * Upload an asset for a chat (before message creation)
 */
async function uploadChatAsset(req, res) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const file = req.file;

    // Verify chat ownership
    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Validate file and derive type/extension
    const validation = await validateChatAssetFile(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const usage = await checkChatAssetDailyLimits(userId, {
      maxUploadsPerDay: CHAT_ASSET_DAILY_UPLOAD_LIMIT,
      maxBytesPerDay: CHAT_ASSET_DAILY_UPLOAD_BYTES_LIMIT,
    });

    if (!usage.allowed || usage.remainingUploads < 1 || usage.remainingBytes < file.size) {
      return res.status(429).json({ error: 'Daily upload limit reached' });
    }

    const assetId = randomUUID();
    const storagePath = `${userId}/${chatId}/${assetId}.${validation.extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(CHAT_ASSETS_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: validation.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload chat asset to storage:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Persist DB record (messageId is null for pending uploads)
    const asset = await chatAssetsRepository.createAsset({
      id: assetId,
      messageId: null, // Will be linked when message is sent
      userId,
      type: validation.type,
      mimeType: validation.mimeType,
      storagePath,
      fileName: file.originalname || null,
      fileSize: file.size || null,
    });

    const url = await createSignedAssetUrl(storagePath);

    return res.status(201).json({
      id: asset.id,
      type: asset.type,
      mimeType: asset.mime_type,
      fileName: asset.file_name,
      fileSize: asset.file_size,
      url,
      createdAt: asset.created_at,
    });
  } catch (err) {
    console.error('Error uploading chat asset:', err);
    return res.status(500).json({ error: 'Unexpected error uploading asset' });
  }
}

/**
 * GET /api/chats/:chatId/assets
 * List all assets for a chat
 */
async function listChatAssets(req, res) {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    // Verify chat ownership
    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const assets = await chatAssetsRepository.listAssetsForChat(chatId, userId);

    const assetsWithUrls = await Promise.all(
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

    res.json(assetsWithUrls);
  } catch (err) {
    console.error('Error listing chat assets:', err);
    res.status(500).json({ error: 'Failed to list assets' });
  }
}

/**
 * DELETE /api/chat-assets/:assetId
 * Delete a chat asset
 */
async function deleteChatAsset(req, res) {
  try {
    const userId = req.user.id;
    const { assetId } = req.params;

    const asset = await chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(CHAT_ASSETS_BUCKET)
      .remove([asset.storage_path]);

    if (storageError) {
      console.error('Failed to delete chat asset from storage:', storageError);
      return res.status(500).json({ error: 'Failed to delete asset' });
    }

    // Delete DB record
    await chatAssetsRepository.deleteAsset(assetId, userId);

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting chat asset:', err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
}

/**
 * Get asset data for vision API (base64 encoded)
 * @param {string} assetId
 * @param {string} userId
 * @returns {Promise<Object|null>} Asset with base64 data
 */
async function getAssetForVision(assetId, userId) {
  const asset = await chatAssetsRepository.getAssetById(assetId, userId);
  if (!asset) return null;

  // Download the file from storage
  const { data, error } = await supabase.storage
    .from(CHAT_ASSETS_BUCKET)
    .download(asset.storage_path);

  if (error) {
    console.error('Failed to download asset for vision:', error);
    return null;
  }

  // Convert to base64
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

/**
 * Read text content from a document asset
 * @param {string} assetId
 * @param {string} userId
 * @returns {Promise<Object|null>} Asset with text content
 */
async function getAssetTextContent(assetId, userId) {
  const asset = await chatAssetsRepository.getAssetById(assetId, userId);
  if (!asset) return null;

  // Download the file from storage
  const { data, error } = await supabase.storage
    .from(CHAT_ASSETS_BUCKET)
    .download(asset.storage_path);

  if (error) {
    console.error('Failed to download asset for text extraction:', error);
    return null;
  }

  const buffer = await data.arrayBuffer();
  let textContent = '';

  // Handle different file types
  if (asset.mime_type === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    try {
      const parsed = await pdfParse(Buffer.from(buffer));
      textContent = parsed.text?.trim() || '';
      if (!textContent) {
        textContent = '[PDF text extraction returned empty]';
      }
    } catch (error) {
      console.error('Failed to extract PDF content:', error);
      textContent = '[PDF text extraction failed]';
    }
  } else if (asset.mime_type.startsWith('text/') || asset.mime_type === 'application/json') {
    // Plain text files
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

module.exports = {
  uploadChatAsset,
  listChatAssets,
  deleteChatAsset,
  getAssetForVision,
  getAssetTextContent,
  createSignedAssetUrl,
};
