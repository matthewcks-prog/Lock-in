const { chatService } = require('../../services/assistant/chatService');
const { DEFAULT_CHAT_LIST_LIMIT, MAX_CHAT_LIST_LIMIT } = require('../../config');

/**
 * Chat Controllers - Thin HTTP layer
 *
 * Validation handled by Zod middleware in routes.
 * Business logic delegated to services.
 */

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

async function listChats(req, res, next) {
  try {
    const userId = req.user?.id;
    // Query params already validated by Zod middleware
    const { limit: requestedLimit, cursor: cursorParam } = req.query;
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
    next(error);
  }
}

async function createChatSession(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(500).json({ error: 'User context missing.' });
    }

    // Body already validated by Zod middleware
    const { title, initialMessage } = req.body;
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
    next(error);
  }
}

async function deleteChat(req, res, next) {
  try {
    const userId = req.user?.id;
    // chatId already validated by Zod validateParams middleware
    const { chatId } = req.params;

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
    next(error);
  }
}

async function listChatMessages(req, res, next) {
  try {
    const userId = req.user?.id;
    // chatId already validated by Zod validateParams middleware
    const { chatId } = req.params;

    const result = await chatService.listChatMessages({ userId, chatId });
    if (result?.notFound) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    return res.json(result.messages);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createChatSession,
  listChats,
  deleteChat,
  listChatMessages,
};
