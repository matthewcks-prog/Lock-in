const pdfParse = require('pdf-parse');

const PDF_MIME_TYPE = 'application/pdf';
const JSON_MIME_TYPE = 'application/json';
const TEXT_MIME_PREFIX = 'text/';
const TEXT_DECODING = 'utf-8';
const PDF_EMPTY_TEXT_MESSAGE = '[PDF text extraction returned empty]';
const PDF_EXTRACTION_FAILED_MESSAGE = '[PDF text extraction failed]';
const BINARY_NOT_EXTRACTABLE_MESSAGE = '[Binary file - content not extractable]';

async function downloadAssetPayload({
  chatAssetsRepository,
  storageRepository,
  logger,
  assetId,
  userId,
  logMessage,
}) {
  const asset = await chatAssetsRepository.getAssetById(assetId, userId);
  if (!asset) {
    return null;
  }

  const { data, error } = await storageRepository.download(asset.storage_path);
  if (error) {
    logger.error({ err: error }, logMessage);
    return null;
  }

  const buffer = await data.arrayBuffer();
  return { asset, buffer };
}

async function getAssetForVision(deps, assetId, userId) {
  const payload = await downloadAssetPayload({
    ...deps,
    assetId,
    userId,
    logMessage: 'Failed to download asset for vision',
  });
  if (!payload) {
    return null;
  }

  const base64 = Buffer.from(payload.buffer).toString('base64');
  return {
    id: payload.asset.id,
    type: payload.asset.type,
    mimeType: payload.asset.mime_type,
    base64,
    fileName: payload.asset.file_name,
  };
}

async function parsePdfText(buffer, logger) {
  try {
    const parsed = await pdfParse(Buffer.from(buffer));
    const text = parsed.text?.trim() || '';
    return text || PDF_EMPTY_TEXT_MESSAGE;
  } catch (error) {
    logger.error({ err: error }, 'Failed to extract PDF content');
    return PDF_EXTRACTION_FAILED_MESSAGE;
  }
}

async function extractAssetTextContent(asset, buffer, logger) {
  if (asset.mime_type === PDF_MIME_TYPE) {
    return parsePdfText(buffer, logger);
  }
  if (asset.mime_type.startsWith(TEXT_MIME_PREFIX) || asset.mime_type === JSON_MIME_TYPE) {
    return Buffer.from(buffer).toString(TEXT_DECODING);
  }
  return BINARY_NOT_EXTRACTABLE_MESSAGE;
}

async function getAssetTextContent(deps, assetId, userId) {
  const payload = await downloadAssetPayload({
    ...deps,
    assetId,
    userId,
    logMessage: 'Failed to download asset for text extraction',
  });
  if (!payload) {
    return null;
  }

  const textContent = await extractAssetTextContent(payload.asset, payload.buffer, deps.logger);
  return {
    id: payload.asset.id,
    type: payload.asset.type,
    mimeType: payload.asset.mime_type,
    textContent,
    fileName: payload.asset.file_name,
  };
}

function createChatAssetContentService({ chatAssetsRepository, storageRepository, logger }) {
  const deps = { chatAssetsRepository, storageRepository, logger };
  return {
    getAssetForVision: (assetId, userId) => getAssetForVision(deps, assetId, userId),
    getAssetTextContent: (assetId, userId) => getAssetTextContent(deps, assetId, userId),
  };
}

module.exports = {
  createChatAssetContentService,
};
