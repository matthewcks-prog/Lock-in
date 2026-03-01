/**
 * Chat Assets Controller
 *
 * Thin HTTP layer delegating to chatAssetsService.
 */

const { chatAssetsService } = require('../../services/assistant/chatAssetsService');
const HTTP_STATUS = require('../../constants/httpStatus');

async function uploadChatAsset(req, res) {
  try {
    const result = await chatAssetsService.uploadChatAsset({
      userId: req.user?.id,
      chatId: req.params.chatId,
      file: req.file,
    });

    return res.status(HTTP_STATUS.CREATED).json(result);
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Error uploading chat asset:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Unexpected error uploading asset',
    });
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
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to list assets' });
  }
}

async function deleteChatAsset(req, res) {
  try {
    await chatAssetsService.deleteChatAsset({
      userId: req.user?.id,
      assetId: req.params.assetId,
    });

    return res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Error deleting chat asset:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to delete asset' });
  }
}

async function getChatAssetStatus(req, res) {
  try {
    const status = await chatAssetsService.getChatAssetStatus({
      userId: req.user?.id,
      assetId: req.params.assetId,
    });

    return res.json(status);
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Error fetching chat asset status:', err);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to fetch asset status' });
  }
}

module.exports = {
  uploadChatAsset,
  listChatAssets,
  getChatAssetStatus,
  deleteChatAsset,
};
