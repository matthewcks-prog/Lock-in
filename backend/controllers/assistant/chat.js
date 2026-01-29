const { supabase } = require('../../supabaseClient');
const {
  createChat,
  getChatById,
  getRecentChats,
  getChatMessages,
} = require('../../chatRepository');
const { DEFAULT_CHAT_LIST_LIMIT, MAX_CHAT_LIST_LIMIT } = require('../../config');
const { validateUUID } = require('../../utils/validation');
const { buildInitialChatTitle } = require('../../utils/chatTitle');
const chatAssetsRepository = require('../../repositories/chatAssetsRepository');
const { createSignedAssetUrl } = require('./assets');

function parseChatCursor(rawCursor) {
  if (typeof rawCursor !== 'string') return null;
  const trimmed = rawCursor.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    const ms = trimmed.length <= 10 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

/**
 * GET /api/chats
 * List recent chats for the authenticated user.
 */
async function listChats(req, res) {
  try {
    const userId = req.user?.id;
    const requestedLimit = parseInt(req.query.limit, 10);
    const cursorParam = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    const cursor = parseChatCursor(cursorParam);

    if (cursorParam && !cursor) {
      return res.status(400).json({ error: 'Invalid cursor parameter' });
    }

    // Validate and constrain limit
    let limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_CHAT_LIST_LIMIT)
        : DEFAULT_CHAT_LIST_LIMIT;

    const { chats, pagination } = await getRecentChats(userId, { limit, cursor });

    const response = chats.map((chat) => ({
      ...chat,
      // Return null for empty titles so frontend can handle fallback/generation
      title: chat.title && chat.title.trim() ? chat.title : null,
    }));

    return res.json({
      chats: response,
      pagination,
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({ error: 'Failed to load chats' });
  }
}

/**
 * POST /api/chats
 * Create a new chat session for the authenticated user.
 */
async function createChatSession(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(500).json({ error: 'User context missing.' });
    }

    const { title, initialMessage } = req.body || {};
    const seed =
      typeof title === 'string' && title.trim().length > 0
        ? title
        : typeof initialMessage === 'string'
          ? initialMessage
          : '';
    const chatTitle = buildInitialChatTitle(seed);

    const chat = await createChat(userId, chatTitle);

    return res.status(201).json({
      id: chat.id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      lastMessageAt: chat.last_message_at,
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({ error: 'Failed to create chat' });
  }
}

/**
 * DELETE /api/chats/:chatId
 * Soft-enforced delete of a chat and its messages (scoped to the user).
 */
async function deleteChat(req, res) {
  try {
    const userId = req.user?.id;
    const chatId = req.params.chatId;

    // Validate chatId format
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: chatIdValidation.error,
      });
    }

    // Verify the chat belongs to the user
    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested chat does not exist for this user',
      });
    }

    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (messagesError) {
      console.error('Error deleting chat messages:', messagesError);
      return res.status(500).json({
        error: 'Failed to delete chat messages',
      });
    }

    const { error: chatError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);

    if (chatError) {
      console.error('Error deleting chat:', chatError);
      return res.status(500).json({
        error: 'Failed to delete chat',
      });
    }

    return res.status(200).json({
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    console.error('Error in delete chat endpoint:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete chat',
    });
  }
}

/**
 * GET /api/chats/:chatId/messages
 * List all messages in a chat owned by the authenticated user.
 */
async function listChatMessages(req, res) {
  try {
    const userId = req.user?.id;
    const { chatId } = req.params;

    // Validate chatId format
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: chatIdValidation.error,
      });
    }

    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await getChatMessages(userId, chatId);
    const assets = await chatAssetsRepository.listAssetsForChat(chatId, userId);
    const assetsByMessage = new Map();

    if (assets.length > 0) {
      const assetsWithUrls = await Promise.all(
        assets.map(async (asset) => ({
          id: asset.id,
          messageId: asset.message_id,
          kind: asset.type,
          mime: asset.mime_type,
          name: asset.file_name || 'Attachment',
          url: await createSignedAssetUrl(asset.storage_path),
        })),
      );

      for (const asset of assetsWithUrls) {
        if (!asset.messageId) continue;
        if (!assetsByMessage.has(asset.messageId)) {
          assetsByMessage.set(asset.messageId, []);
        }
        assetsByMessage.get(asset.messageId).push(asset);
      }
    }

    const response = messages.map((message) => {
      const attachments = assetsByMessage.get(message.id);
      if (!attachments || attachments.length === 0) {
        return message;
      }
      return { ...message, attachments };
    });

    return res.json(response);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return res.status(500).json({ error: 'Failed to load chat messages' });
  }
}

module.exports = {
  createChatSession,
  listChats,
  deleteChat,
  listChatMessages,
};
