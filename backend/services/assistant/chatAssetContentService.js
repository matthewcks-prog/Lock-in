const pdfParse = require('pdf-parse');

function createChatAssetContentService({ chatAssetsRepository, storageRepository, logger }) {
  async function getAssetForVision(assetId, userId) {
    const asset = await chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) return null;

    const { data, error } = await storageRepository.download(asset.storage_path);
    if (error) {
      logger.error({ err: error }, 'Failed to download asset for vision');
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
    const asset = await chatAssetsRepository.getAssetById(assetId, userId);
    if (!asset) return null;

    const { data, error } = await storageRepository.download(asset.storage_path);
    if (error) {
      logger.error({ err: error }, 'Failed to download asset for text extraction');
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
        logger.error({ err: error }, 'Failed to extract PDF content');
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

  return { getAssetForVision, getAssetTextContent };
}

module.exports = {
  createChatAssetContentService,
};
