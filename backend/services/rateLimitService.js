const {
  countAiRequestsSince,
  getChatAssetUsageSince,
} = require('../repositories/rateLimitRepository');

function getStartOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function checkDailyLimit(userId, maxPerDay = 100) {
  if (!userId) {
    throw new Error('checkDailyLimit requires a userId');
  }

  const upperLimit = Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : Infinity;
  if (!Number.isFinite(upperLimit)) {
    return { allowed: true, remaining: Infinity };
  }

  const startOfToday = getStartOfTodayUTC().toISOString();

  const used = await countAiRequestsSince({ userId, since: startOfToday });

  if (used >= upperLimit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: upperLimit - used };
}

async function checkChatAssetDailyLimits(
  userId,
  { maxUploadsPerDay = Infinity, maxBytesPerDay = Infinity } = {},
) {
  if (!userId) {
    throw new Error('checkChatAssetDailyLimits requires a userId');
  }

  const uploadLimit =
    Number.isFinite(maxUploadsPerDay) && maxUploadsPerDay > 0 ? maxUploadsPerDay : Infinity;
  const bytesLimit =
    Number.isFinite(maxBytesPerDay) && maxBytesPerDay > 0 ? maxBytesPerDay : Infinity;

  if (!Number.isFinite(uploadLimit) && !Number.isFinite(bytesLimit)) {
    return { allowed: true, remainingUploads: Infinity, remainingBytes: Infinity };
  }

  const startOfToday = getStartOfTodayUTC().toISOString();
  const { usedUploads, usedBytes } = await getChatAssetUsageSince({
    userId,
    since: startOfToday,
  });

  const remainingUploads = Number.isFinite(uploadLimit)
    ? Math.max(uploadLimit - usedUploads, 0)
    : Infinity;
  const remainingBytes = Number.isFinite(bytesLimit)
    ? Math.max(bytesLimit - usedBytes, 0)
    : Infinity;

  return {
    allowed: remainingUploads > 0 && remainingBytes > 0,
    remainingUploads,
    remainingBytes,
  };
}

module.exports = {
  checkDailyLimit,
  checkChatAssetDailyLimits,
};
