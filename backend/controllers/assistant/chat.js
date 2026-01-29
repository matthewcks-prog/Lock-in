const { chatService } = require('../../services/assistant/chatService');
const { DEFAULT_CHAT_LIST_LIMIT, MAX_CHAT_LIST_LIMIT } = require('../../config');
const { validateUUID } = require('../../utils/validation');

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

async function listChats(req, res) {
  try {
    const userId = req.user?.id;
    const requestedLimit = parseInt(req.query.limit, 10);
    const cursorParam = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    const cursor = parseChatCursor(cursorParam);

    if (cursorParam && !cursor) {
      return res.status(400).json({ error: 'Invalid cursor parameter' });
    }

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_CHAT_LIST_LIMIT)
        : DEFAULT_CHAT_LIST_LIMIT;

    const { chats, pagination } = await chatService.listChats({ userId, limit, cursor });

    const response = chats.map((chat) => ({
      ...chat,
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

    const chat = await chatService.createChatSession({ userId, titleSeed: seed });

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

async function deleteChat(req, res) {
  try {
    const userId = req.user?.id;
    const chatId = req.params.chatId;

    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: chatIdValidation.error,
      });
    }

    const result = await chatService.deleteChat({ userId, chatId });
    if (result?.notFound) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested chat does not exist for this user',
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

async function listChatMessages(req, res) {
  try {
    const userId = req.user?.id;
    const { chatId } = req.params;

    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: chatIdValidation.error,
      });
    }

    const result = await chatService.listChatMessages({ userId, chatId });
    if (result?.notFound) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    return res.json(result.messages);
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
