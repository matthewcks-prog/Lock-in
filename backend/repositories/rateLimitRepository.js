const { supabase } = require('../db/supabaseClient');

async function countAiRequestsSince({ userId, since }) {
  const { error, count } = await supabase
    .from('ai_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (error) {
    throw new Error(`Failed to count AI requests: ${error.message}`);
  }

  return typeof count === 'number' ? count : 0;
}

async function getChatAssetUsageSince({ userId, since }) {
  const { data, error, count } = await supabase
    .from('chat_message_assets')
    .select('file_size', { count: 'exact' })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (error) {
    throw new Error(`Failed to fetch chat asset usage: ${error.message}`);
  }

  const usedUploads = typeof count === 'number' ? count : 0;
  const usedBytes = (data || []).reduce((sum, row) => sum + (row.file_size || 0), 0);

  return { usedUploads, usedBytes };
}

module.exports = {
  countAiRequestsSince,
  getChatAssetUsageSince,
};
