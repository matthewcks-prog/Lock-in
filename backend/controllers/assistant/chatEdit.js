/**
 * Chat Edit Controller
 *
 * Thin HTTP layer for message editing and regeneration.
 * All business logic is delegated to chatEditService.
 *
 * @module controllers/assistant/chatEdit
 */

const { chatEditService } = require('../../services/assistant/chatEditService');
const HTTP_STATUS = require('../../constants/httpStatus');

/**
 * Edit a user message and truncate subsequent messages.
 * PUT /api/chats/:chatId/messages/:messageId
 *
 * After editing, the client should trigger regeneration via the
 * streaming endpoint with the updated canonical history.
 */
async function editMessage(req, res, next) {
  try {
    const userId = req.user?.id;
    const { chatId, messageId } = req.params;
    const { content } = req.body;

    const result = await chatEditService.editMessageAndTruncate({
      userId,
      chatId,
      messageId,
      newContent: content,
    });

    return res.status(HTTP_STATUS.OK).json({
      revision: {
        id: result.revision.id,
        role: result.revision.role,
        content: result.revision.input_text,
        createdAt: result.revision.created_at,
        revisionOf: result.revision.revision_of,
      },
      canonicalMessages: result.canonicalMessages,
      truncatedCount: result.truncatedCount,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Prepare for regeneration: truncate the last assistant message.
 * POST /api/chats/:chatId/regenerate
 *
 * Returns the updated canonical timeline so the client can
 * immediately call the streaming endpoint to get a new response.
 */
async function regenerateMessage(req, res, next) {
  try {
    const userId = req.user?.id;
    const { chatId } = req.params;

    const result = await chatEditService.truncateForRegeneration({
      userId,
      chatId,
    });

    return res.status(HTTP_STATUS.OK).json({
      canonicalMessages: result.canonicalMessages,
      truncatedCount: result.truncatedCount,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  editMessage,
  regenerateMessage,
};
