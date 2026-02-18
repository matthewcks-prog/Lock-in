const { supabase } = require('../db/supabaseClient');
const { DEFAULT_CHAT_LIST_LIMIT } = require('../config');

/**
 * Create a new chat row for the given user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function createChat(userId, title = null) {
  if (!userId) {
    throw new Error('createChat requires a userId');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('chats')
    .insert([{ user_id: userId, title, last_message_at: now }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create chat: ${error.message}`);
  }

  return data;
}

/**
 * Fetch a chat by id ensuring it belongs to the user.
 * @param {string} userId
 * @param {string} chatId
 * @returns {Promise<object|null>}
 */
async function getChatById(userId, chatId) {
  if (!userId || !chatId) {
    return null;
  }

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch chat: ${error.message}`);
  }

  return data || null;
}

/**
 * Insert a new chat message row.
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function insertChatMessage(payload) {
  const { data, error } = await supabase.from('chat_messages').insert([payload]).select().single();

  if (error) {
    throw new Error(`Failed to insert chat message: ${error.message}`);
  }

  return data;
}

/**
 * Update chat timestamps after a new message.
 * @param {string} chatId
 * @returns {Promise<void>}
 */
async function touchChat(chatId) {
  if (!chatId) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('chats')
    .update({ updated_at: now, last_message_at: now })
    .eq('id', chatId);

  if (error) {
    throw new Error(`Failed to update chat timestamps: ${error.message}`);
  }
}

/**
 * Fetch recent chats for the user ordered by last activity.
 * @param {string} userId
 * @param {{ limit?: number, cursor?: string | null }} options
 * @returns {Promise<{chats: object[], pagination: {hasMore: boolean, nextCursor: string | null}}>}
 */
async function getRecentChats(userId, options = {}) {
  const { limit = DEFAULT_CHAT_LIST_LIMIT, cursor } = options;
  const cappedLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CHAT_LIST_LIMIT;

  let query = supabase
    .from('chats')
    .select('id,title,created_at,updated_at,last_message_at')
    .eq('user_id', userId)
    .not('last_message_at', 'is', null) // FIXED: Exclude chats with null last_message_at from pagination
    .order('last_message_at', { ascending: false });

  // Only apply cursor filter if cursor is provided
  if (cursor && typeof cursor === 'string' && cursor.length > 0) {
    query = query.lt('last_message_at', cursor);
  }

  const { data, error } = await query.limit(cappedLimit + 1);

  if (error) {
    throw new Error(`Failed to fetch chats: ${error.message}`);
  }

  const rows = data || [];
  const hasMore = rows.length > cappedLimit;
  const chats = hasMore ? rows.slice(0, cappedLimit) : rows;
  const lastItem = chats[chats.length - 1];
  const nextCursor = lastItem?.last_message_at || null;
  const canPageMore = hasMore && Boolean(nextCursor);

  return {
    chats,
    pagination: {
      hasMore: canPageMore,
      nextCursor: canPageMore ? nextCursor : null,
    },
  };
}

/**
 * Fetch canonical messages for a chat (the current visible timeline).
 * Non-canonical messages (superseded by edits) are excluded.
 * @param {string} userId
 * @param {string} chatId
 * @returns {Promise<object[]>}
 */
async function getChatMessages(userId, chatId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(
      'id,role,mode,source,input_text,output_text,created_at,status,edited_at,revision_of,chat_id,user_id',
    )
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .eq('is_canonical', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  return (data || []).map(({ chat_id: _chat_id, user_id: _user_id, ...rest }) => rest);
}

/**
 * Update the stored chat title for a user's chat.
 * @param {string} userId
 * @param {string} chatId
 * @param {string} title
 * @returns {Promise<object>}
 */
async function updateChatTitle(userId, chatId, title) {
  if (!userId || !chatId) {
    throw new Error('updateChatTitle requires userId and chatId');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('chats')
    .update({ title, updated_at: now })
    .eq('id', chatId)
    .eq('user_id', userId)
    .select('id,title,updated_at,last_message_at,created_at')
    .single();

  if (error) {
    throw new Error(`Failed to update chat title: ${error.message}`);
  }

  return data;
}

/**
 * Delete chat messages for a chat owned by user.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.chatId
 * @returns {Promise<void>}
 */
async function deleteChatMessages({ userId, chatId }) {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete chat messages: ${error.message}`);
  }
}

/**
 * Delete a chat owned by user.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.chatId
 * @returns {Promise<void>}
 */
async function deleteChat({ userId, chatId }) {
  const { error } = await supabase.from('chats').delete().eq('id', chatId).eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete chat: ${error.message}`);
  }
}

/**
 * Fetch a single message by ID, ensuring ownership.
 * @param {string} userId
 * @param {string} chatId
 * @param {string} messageId
 * @returns {Promise<object|null>}
 */
async function getMessageById(userId, chatId, messageId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch message: ${error.message}`);
  }
  return data || null;
}

/**
 * Edit a user message using atomic transaction.
 * Uses stored procedure to ensure all-or-nothing execution.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.chatId
 * @param {string} params.messageId - original message to revise
 * @param {string} params.newContent - updated message content
 * @returns {Promise<{revision: object, canonicalMessages: object[], truncatedCount: number}>}
 */
async function editMessage({ userId, chatId, messageId, newContent }) {
  const { data, error } = await supabase.rpc('edit_message_transaction', {
    p_user_id: userId,
    p_chat_id: chatId,
    p_message_id: messageId,
    p_new_content: newContent,
  });

  if (error) {
    throw new Error(`Failed to edit message: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Edit transaction returned no data');
  }

  const result = data[0];
  const canonicalMessages = result.canonical_messages || [];
  const truncatedCount = result.truncated_count || 0;
  const revisionId = result.revision_id;

  // Find the revision message in canonical timeline
  const revision = canonicalMessages.find((msg) => msg.id === revisionId);
  if (!revision) {
    throw new Error('Revision message not found in canonical timeline');
  }

  return {
    revision,
    canonicalMessages,
    truncatedCount,
  };
}

/**
 * Prepare for message regeneration using atomic transaction.
 * Uses stored procedure to truncate last assistant response atomically.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.chatId
 * @returns {Promise<{canonicalMessages: object[], truncatedCount: number, lastUserMessageId: string}>}
 */
async function truncateForRegeneration({ userId, chatId }) {
  const { data, error } = await supabase.rpc('regenerate_message_transaction', {
    p_user_id: userId,
    p_chat_id: chatId,
  });

  if (error) {
    throw new Error(`Failed to prepare regeneration: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('Regeneration transaction returned no data');
  }

  const result = data[0];
  return {
    canonicalMessages: result.canonical_messages || [],
    truncatedCount: result.truncated_count || 0,
    lastUserMessageId: result.last_user_message_id,
  };
}

/**
 * DEPRECATED: Use truncateForRegeneration instead.
 * Kept for backward compatibility during migration.
 */
async function truncateAfterMessage({ userId, chatId, afterMessageId }) {
  // Get the reference message's created_at
  const refMessage = await getMessageById(userId, chatId, afterMessageId);
  if (!refMessage) {
    throw new Error('Reference message not found for truncation');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .update({ is_canonical: false })
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .eq('is_canonical', true)
    .gt('created_at', refMessage.created_at)
    .select('id');

  if (error) {
    throw new Error(`Failed to truncate messages: ${error.message}`);
  }

  return (data || []).length;
}

/**
 * Update the delivery status of a message.
 * @param {string} userId
 * @param {string} messageId
 * @param {string} status - 'sending' | 'sent' | 'failed'
 * @returns {Promise<void>}
 */
async function updateMessageStatus(userId, messageId, status) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ status })
    .eq('id', messageId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update message status: ${error.message}`);
  }
}

module.exports = {
  createChat,
  getChatById,
  insertChatMessage,
  touchChat,
  getRecentChats,
  getChatMessages,
  getMessageById,
  editMessage,
  truncateForRegeneration,
  truncateAfterMessage,
  updateMessageStatus,
  updateChatTitle,
  deleteChatMessages,
  deleteChat,
};
