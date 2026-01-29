const { generateChatTitleFromHistory } = require('../../openaiClient');
const { getChatMessages, getChatById, updateChatTitle } = require('../../chatRepository');
const {
  buildInitialChatTitle,
  extractFirstUserMessage,
  FALLBACK_TITLE,
} = require('../../utils/chatTitle');
const { validateUUID } = require('../../utils/validation');

/**
 * Helper function to generate chat title asynchronously (non-blocking)
 * Used for automatic title generation after chat messages
 */
async function generateChatTitleAsync(userId, chatId, fallbackText = '') {
  try {
    const messages = await getChatMessages(userId, chatId);

    const normalizedHistory = (messages || [])
      .map((message) => {
        const content =
          (typeof message.content === 'string' && message.content.trim()) ||
          (typeof message.input_text === 'string' && message.input_text.trim()) ||
          (typeof message.output_text === 'string' && message.output_text.trim()) ||
          '';

        if (!content) return null;

        return {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: content.trim(),
        };
      })
      .filter(Boolean);

    // Need at least one user message and one assistant message to generate a meaningful title
    const hasUser = normalizedHistory.some((message) => message.role === 'user');
    const hasAssistant = normalizedHistory.some((message) => message.role === 'assistant');

    if (normalizedHistory.length < 2 || !hasUser || !hasAssistant) {
      return;
    }

    const fallbackTitle = buildInitialChatTitle(
      extractFirstUserMessage(messages) || fallbackText || '',
    );

    const generatedTitle = await generateChatTitleFromHistory({
      history: normalizedHistory,
      fallbackTitle,
    });

    await updateChatTitle(userId, chatId, generatedTitle);
  } catch (error) {
    console.error('Error in async title generation:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * POST /api/chats/:chatId/title
 * Generate and persist a short chat title using OpenAI, with a safe fallback.
 */
async function generateChatTitle(req, res) {
  const userId = req.user?.id;
  const { chatId } = req.params;
  let fallbackTitle = FALLBACK_TITLE;

  try {
    const chatIdValidation = validateUUID(chatId);
    if (!chatIdValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { message: chatIdValidation.error },
      });
    }

    const chat = await getChatById(userId, chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: { message: 'Chat not found' } });
    }

    const messages = await getChatMessages(userId, chatId);

    const normalizedHistory = (messages || [])
      .map((message) => {
        const content =
          (typeof message.content === 'string' && message.content.trim()) ||
          (typeof message.input_text === 'string' && message.input_text.trim()) ||
          (typeof message.output_text === 'string' && message.output_text.trim()) ||
          '';

        if (!content) return null;

        return {
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: content.trim(),
        };
      })
      .filter(Boolean);

    fallbackTitle = buildInitialChatTitle(extractFirstUserMessage(messages) || chat.title || '');

    const generatedTitle = await generateChatTitleFromHistory({
      history: normalizedHistory,
      fallbackTitle,
    });

    const stored = await updateChatTitle(userId, chatId, generatedTitle);

    return res.json({
      success: true,
      chatId,
      title: stored?.title || generatedTitle,
    });
  } catch (error) {
    console.error('Error generating chat title:', error);
    const safeTitle = buildInitialChatTitle(fallbackTitle || FALLBACK_TITLE);
    try {
      if (userId && chatId) {
        await updateChatTitle(userId, chatId, safeTitle);
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
  generateChatTitleAsync,
};
