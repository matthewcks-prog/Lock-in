const STATUS_READY = 'ready';
const STATUS_PROCESSING = 'processing';
const STATUS_ERROR = 'error';
const NO_EXTRACTABLE_TEXT_ERROR = 'No extractable text found';
const PROCESSING_FAILED_ERROR = 'Processing failed';

function truncateText(text, maxProcessedChars) {
  if (typeof text !== 'string') {
    return '';
  }
  if (text.length <= maxProcessedChars) {
    return text;
  }
  return text.slice(0, maxProcessedChars);
}

function processingTimestamp() {
  return new Date().toISOString();
}

async function updateAssetProcessingState(context, { assetId, userId, updates }) {
  await context.services.chatAssetsRepository.updateAssetProcessing({
    assetId,
    userId,
    updates,
  });
}

async function markAssetAsProcessing(context, assetId, userId) {
  const now = processingTimestamp();
  await updateAssetProcessingState(context, {
    assetId,
    userId,
    updates: {
      processing_status: STATUS_PROCESSING,
      processing_started_at: now,
      processing_updated_at: now,
      processing_error: null,
    },
  });
}

async function markAssetAsError(context, assetId, userId, message) {
  await updateAssetProcessingState(context, {
    assetId,
    userId,
    updates: {
      processing_status: STATUS_ERROR,
      processing_error: message,
      processing_updated_at: processingTimestamp(),
    },
  });
}

async function markAssetAsReady(context, assetId, userId, textContent) {
  const now = processingTimestamp();
  await updateAssetProcessingState(context, {
    assetId,
    userId,
    updates: {
      processing_status: STATUS_READY,
      processed_text: truncateText(textContent, context.maxProcessedChars),
      processing_error: null,
      processing_updated_at: now,
      processing_completed_at: now,
    },
  });
}

async function processAssetInBackground(context, { assetId, userId } = {}) {
  if (!assetId || !userId) {
    return;
  }

  await markAssetAsProcessing(context, assetId, userId);

  try {
    const textData = await context.getAssetTextContent(assetId, userId);
    if (!textData?.textContent) {
      await markAssetAsError(context, assetId, userId, NO_EXTRACTABLE_TEXT_ERROR);
      return;
    }
    await markAssetAsReady(context, assetId, userId, textData.textContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : PROCESSING_FAILED_ERROR;
    await markAssetAsError(context, assetId, userId, message);
    throw error;
  }
}

module.exports = {
  processAssetInBackground,
};
