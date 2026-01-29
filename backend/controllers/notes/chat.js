// backend/controllers/notes/chat.js

const chatService = require('../../services/notes/chatService');

/**
 * Chat with Notes Controller
 *
 * Thin HTTP layer that delegates to chatService.
 * Validation handled by middleware (validate(chatWithNotesSchema)).
 */

// POST /api/notes/chat
// body: { query: string, courseCode?: string, k?: number }
async function chatWithNotes(req, res, next) {
  try {
    const userId = req.user.id;
    const { query, courseCode, k } = req.body;

    // Validate and limit k parameter
    const matchCount = k ? Math.min(Math.max(parseInt(k, 10), 1), 20) : 8;

    // Delegate to service
    const result = await chatService.chatWithNotes({
      userId,
      query,
      courseCode,
      matchCount,
    });

    res.json(result);
  } catch (err) {
    // Service throws descriptive errors
    if (err.message === 'Failed to process search query') {
      return res.status(500).json({
        success: false,
        error: { message: err.message },
      });
    }
    if (err.message === 'Failed to generate answer') {
      return res.status(500).json({
        success: false,
        error: { message: err.message },
      });
    }
    next(err);
  }
}

module.exports = {
  chatWithNotes,
};
