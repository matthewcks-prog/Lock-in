const { supabase } = require('../db/supabaseClient');

const USER_SCOPED_TABLE_DELETE_ORDER = [
  'chat_message_assets',
  'chat_messages',
  'chats',
  'note_assets',
  'notes',
  'tasks',
  'feedback',
  'ai_requests',
  'transcripts',
  'transcript_jobs',
  'transcript_upload_windows',
  'idempotency_keys',
  'folders',
];

function ensureUserId(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('userId is required');
  }
}

async function deleteRowsByUserId(tableName, userId) {
  const { error } = await supabase.from(tableName).delete().eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to delete ${tableName} rows for user: ${error.message}`);
  }
}

async function deleteUserDomainData(userId) {
  for (const tableName of USER_SCOPED_TABLE_DELETE_ORDER) {
    await deleteRowsByUserId(tableName, userId);
  }
}

async function deleteAuthUser(userId) {
  const authAdmin = supabase.auth?.admin;
  if (authAdmin === undefined || typeof authAdmin.deleteUser !== 'function') {
    throw new Error('Supabase auth admin client is not available');
  }

  const { error } = await authAdmin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}

async function deleteUserAccount(userId) {
  ensureUserId(userId);
  await deleteUserDomainData(userId);
  await deleteAuthUser(userId);
}

module.exports = {
  USER_SCOPED_TABLE_DELETE_ORDER,
  deleteUserAccount,
};
