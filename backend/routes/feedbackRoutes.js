// backend/routes/feedbackRoutes.js

const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const feedbackController = require('../controllers/feedback');
const { validate, validateQuery, validateParams } = require('../validators/middleware');
const {
  createFeedbackSchema,
  listFeedbackQuerySchema,
  feedbackIdParamSchema,
} = require('../validators/feedbackValidators');

const router = express.Router();

// All feedback routes require authentication
router.use(requireSupabaseUser);

// POST /api/feedback - Submit new feedback
router.post('/feedback', validate(createFeedbackSchema), feedbackController.createFeedback);

// GET /api/feedback - List user's own feedback
router.get(
  '/feedback',
  validateQuery(listFeedbackQuerySchema),
  feedbackController.listUserFeedback,
);

// GET /api/feedback/:feedbackId - Get specific feedback
router.get(
  '/feedback/:feedbackId',
  validateParams(feedbackIdParamSchema),
  feedbackController.getFeedback,
);

module.exports = router;
