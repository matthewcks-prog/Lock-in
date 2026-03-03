const { supabase } = require('../db/supabaseClient');
const { NOTE_ASSETS_BUCKET, CHAT_ASSETS_BUCKET } = require('../config');

const REQUIRED_BUCKETS = [NOTE_ASSETS_BUCKET, CHAT_ASSETS_BUCKET];

async function ensureStorageBuckets(logger) {
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    logger.warn({ err: listError }, 'Could not list storage buckets; skipping auto-creation');
    return;
  }

  const existingIds = new Set((existing ?? []).map((b) => b.id));

  for (const bucketId of REQUIRED_BUCKETS) {
    if (existingIds.has(bucketId)) continue;

    const { error: createError } = await supabase.storage.createBucket(bucketId, {
      public: false,
    });

    if (createError) {
      logger.warn({ err: createError, bucket: bucketId }, `Failed to create storage bucket`);
    } else {
      logger.info({ bucket: bucketId }, 'Created missing storage bucket');
    }
  }
}

module.exports = { ensureStorageBuckets };
