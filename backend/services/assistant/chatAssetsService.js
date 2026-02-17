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
const { checkChatAssetDailyLimits } = require('../rateLimitService');
const { createChatAssetContentService } = require('./chatAssetContentService');
const {
  createChatAssetsOperations,
  DEFAULT_MAX_PROCESSED_CHARS,
} = require('./chatAssetsOperations');

function createStorageRepo(deps, bucket) {
  if (deps.storageRepository) {
    return deps.storageRepository;
  }
  return createStorageRepository({
    bucket,
    supabaseClient: deps.supabase,
  });
}

function createServices(deps, bucket, storageRepository) {
  return {
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
}

function createChatAssetsService(deps = {}) {
  const bucket = deps.bucket ?? CHAT_ASSETS_BUCKET;
  const storageRepository = createStorageRepo(deps, bucket);
  const services = createServices(deps, bucket, storageRepository);
  const { getAssetForVision, getAssetTextContent } = createChatAssetContentService(services);
  const operations = createChatAssetsOperations({
    services,
    getAssetForVision,
    getAssetTextContent,
    maxProcessedChars: deps.maxProcessedChars ?? DEFAULT_MAX_PROCESSED_CHARS,
  });

  return {
    ...operations,
    getAssetForVision,
    getAssetTextContent,
  };
}

const chatAssetsService = createChatAssetsService();

module.exports = {
  createChatAssetsService,
  chatAssetsService,
};
