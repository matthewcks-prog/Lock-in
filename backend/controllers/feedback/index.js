// backend/controllers/feedback/index.js

const { feedbackService } = require('../../services/feedbackService');

/**
 * POST /api/feedback
 * Create new feedback entry
 */
async function createFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const feedback = await feedbackService.createFeedback({
      userId,
      payload: req.body,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      id: feedback.id,
      message: 'Thank you for your feedback!',
    });
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    next(err);
  }
}

/**
 * GET /api/feedback
 * List user's own feedback
 */
async function listUserFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const feedback = await feedbackService.listUserFeedback({ userId, limit });

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
 * Get a specific feedback entry
 */
async function getFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const { feedbackId } = req.params;

    const feedback = await feedbackService.getFeedback({ userId, feedbackId });

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    if (err?.status && err?.payload) {
      return res.status(err.status).json(err.payload);
    }
    next(err);
  }
}

module.exports = {
  createFeedback,
  listUserFeedback,
  getFeedback,
};
