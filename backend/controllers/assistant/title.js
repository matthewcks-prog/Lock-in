const { chatService } = require('../../services/assistant/chatService');
const { chatTitleService } = require('../../services/assistant/chatTitleService');
const { buildInitialChatTitle } = require('../../utils/chatTitle');
const { validateUUID } = require('../../utils/validation');

/**
 * POST /api/chats/:chatId/title
 * Generate and persist a short chat title using OpenAI, with a safe fallback.
 */
async function generateChatTitle(req, res) {
  const userId = req.user?.id;
  const { chatId } = req.params;
  let fallbackTitle = chatTitleService.FALLBACK_TITLE;

  try {
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: chatIdValidation.error },
      });
    }

    const chat = await chatService.getChatById({ userId, chatId });
    if (!chat) {
      return res.status(404).json({ success: false, error: { message: 'Chat not found' } });
    }

    fallbackTitle = await chatTitleService.buildFallbackTitle({
      userId,
      chatId,
      fallbackText: chat.title || '',
    });

    const result = await chatTitleService.generateChatTitle({
      userId,
      chatId,
      fallbackText: chat.title || '',
    });

    return res.json({
      success: true,
      chatId,
      title: result.title,
    });
  } catch (error) {
    console.error('Error generating chat title:', error);
    const safeTitle = buildInitialChatTitle(fallbackTitle || chatTitleService.FALLBACK_TITLE);
    try {
      if (userId && chatId) {
        await chatTitleService.persistChatTitle({ userId, chatId, title: safeTitle });
      }
    } catch (storageError) {
      console.error('Failed to persist fallback chat title:', storageError);
    }

    return res.status(200).json({
      success: true,
      chatId,
      title: safeTitle,
    });
  }
}

module.exports = {
  generateChatTitle,
};
