/**
 * Chat Assets Repository
 *
 * Database operations for chat message attachments.
 * Mirrors the pattern from noteAssetsRepository.js
 */

const { supabase } = require('../supabaseClient');

/**
 * Create a new chat asset record
 * @param {Object} params
 * @param {string} params.id - Asset UUID
 * @param {string|null} params.messageId - Parent message ID (nullable for pending uploads)
 * @param {string} params.userId - Owner user ID
 * @param {string} params.type - Asset type (image, document, code, other)
 * @param {string} params.mimeType - MIME type
 * @param {string} params.storagePath - Path in storage bucket
 * @param {string|null} params.fileName - Original filename
 * @param {number|null} params.fileSize - File size in bytes
 * @returns {Promise<Object>}
 */
async function createAsset({
  id,
  messageId,
  userId,
  type,
  mimeType,
  storagePath,
  fileName,
  fileSize,
}) {
  const { data, error } = await supabase
    .from('chat_message_assets')
    .insert({
      id,
      message_id: messageId || null,
      user_id: userId,
      type,
      mime_type: mimeType,
      storage_path: storagePath,
      file_name: fileName || null,
      file_size: fileSize || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * List assets for a specific chat message
 * @param {string} messageId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function listAssetsForMessage(messageId, userId) {
  const { data, error } = await supabase
    .from('chat_message_assets')
    .select('*')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * List all assets for a chat (across all messages)
 * @param {string} chatId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function listAssetsForChat(chatId, userId) {
  // Join with chat_messages to get assets for all messages in the chat
  const { data, error } = await supabase
    .from('chat_message_assets')
    .select(
      `
      *,
      chat_messages!inner(chat_id)
    `,
    )
    .eq('user_id', userId)
    .eq('chat_messages.chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(({ chat_messages, ...asset }) => asset);
}

/**
 * Get a single asset by ID
 * @param {string} assetId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getAssetById(assetId, userId) {
  const { data, error } = await supabase
    .from('chat_message_assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Delete an asset record
 * @param {string} assetId
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteAsset(assetId, userId) {
  const { error } = await supabase
    .from('chat_message_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Link pending assets to a message after message creation
 * @param {string[]} assetIds - Array of asset IDs to link
 * @param {string} messageId - Message ID to link to
 * @param {string} userId - Owner user ID
 * @returns {Promise<void>}
 */
async function linkAssetsToMessage(assetIds, messageId, userId) {
  if (!assetIds || assetIds.length === 0) return;

  const { error } = await supabase
    .from('chat_message_assets')
    .update({ message_id: messageId })
    .in('id', assetIds)
    .eq('user_id', userId);

  if (error) throw error;
}

module.exports = {
  createAsset,
  listAssetsForMessage,
  listAssetsForChat,
  getAssetById,
  deleteAsset,
  linkAssetsToMessage,
};
