const { supabase } = require('./supabaseClient');

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
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function getRecentChats(userId, limit = 5) {
  const cappedLimit = Number.isFinite(limit) && limit > 0 ? limit : 5;
  const { data, error } = await supabase
    .from('chats')
    .select('id,title,created_at,updated_at,last_message_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(cappedLimit);

  if (error) {
    throw new Error(`Failed to fetch chats: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch all messages for a chat if owned by user.
 * @param {string} userId
 * @param {string} chatId
 * @returns {Promise<object[]>}
 */
async function getChatMessages(userId, chatId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id,role,mode,source,input_text,output_text,created_at,chat_id,user_id')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  return (data || []).map(({ chat_id, user_id, ...rest }) => rest);
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

module.exports = {
  createChat,
  getChatById,
  insertChatMessage,
  touchChat,
  getRecentChats,
  getChatMessages,
  updateChatTitle,
};
