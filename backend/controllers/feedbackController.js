// backend/controllers/feedbackController.js

const feedbackRepo = require('../repositories/feedbackRepository');

/**
 * Feedback controller for handling user-submitted feedback.
 * Supports bug reports, feature requests, and questions.
 */

// Validation constants
const MAX_MESSAGE_LENGTH = 5000;
const VALID_TYPES = ['bug', 'feature', 'question', 'other'];

/**
 * Validate feedback type
 */
function isValidType(type) {
  return VALID_TYPES.includes(type);
}

/**
 * Validate UUID format
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * POST /api/feedback
 * Create new feedback entry
 */
async function createFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const { type, message, context } = req.body;

    // Validate type
    if (!type || !isValidType(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: `type must be one of: ${VALID_TYPES.join(', ')}`,
        },
      });
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MESSAGE',
          message: 'message is required',
        },
      });
    }

    // Validate message length
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
        },
      });
    }

    // Sanitize context (only allow expected fields)
    const sanitizedContext = context
      ? {
          url: context.url?.slice(0, 2000) || null,
          courseCode: context.courseCode?.slice(0, 50) || null,
          extensionVersion: context.extensionVersion?.slice(0, 20) || null,
          browser: context.browser?.slice(0, 200) || null,
          page: context.page?.slice(0, 200) || null,
        }
      : null;

    // Merge server-detected info into context
    const userAgent = req.headers['user-agent'];
    const finalContext = {
      ...sanitizedContext,
      serverUserAgent: userAgent?.slice(0, 500) || null,
      submittedAt: new Date().toISOString(),
    };

    const feedback = await feedbackRepo.createFeedback({
      userId,
      type,
      message: message.trim(),
      context: finalContext,
    });

    res.status(201).json({
      success: true,
      id: feedback.id,
      message: 'Thank you for your feedback!',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/feedback
 * List user's own feedback (for "My Feedback" feature)
 */
async function listUserFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const feedbackLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 50;

    const feedback = await feedbackRepo.getFeedbackByUser(userId, { limit: feedbackLimit });

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/feedback/:feedbackId
 * Get a specific feedback entry (user can only see their own)
 */
async function getFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const { feedbackId } = req.params;

    if (!feedbackId || !isValidUUID(feedbackId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FEEDBACK_ID',
          message: 'feedbackId must be a valid UUID',
        },
      });
    }

    const feedback = await feedbackRepo.getFeedbackById(feedbackId, userId);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Feedback not found',
        },
      });
    }

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createFeedback,
  listUserFeedback,
  getFeedback,
};
