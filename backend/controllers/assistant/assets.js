/**
 * Chat Assets Controller
 *
 * Thin HTTP layer delegating to chatAssetsService.
 */

const { chatAssetsService } = require('../../services/assistant/chatAssetsService');

async function uploadChatAsset(req, res) {
  try {
    const result = await chatAssetsService.uploadChatAsset({
      userId: req.user?.id,
      chatId: req.params.chatId,
      file: req.file,
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Error uploading chat asset:', err);
    return res.status(500).json({ error: 'Unexpected error uploading asset' });
  }
}

async function listChatAssets(req, res) {
  try {
    const assets = await chatAssetsService.listChatAssets({
      userId: req.user?.id,
      chatId: req.params.chatId,
    });

    return res.json(assets);
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Error listing chat assets:', err);
    return res.status(500).json({ error: 'Failed to list assets' });
  }
}

async function deleteChatAsset(req, res) {
  try {
    await chatAssetsService.deleteChatAsset({
      userId: req.user?.id,
      assetId: req.params.assetId,
    });

    return res.status(204).send();
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Error deleting chat asset:', err);
    return res.status(500).json({ error: 'Failed to delete asset' });
  }
}

module.exports = {
  uploadChatAsset,
  listChatAssets,
  deleteChatAsset,
};
