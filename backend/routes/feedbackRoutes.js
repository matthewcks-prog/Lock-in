// backend/routes/feedbackRoutes.js

const express = require('express');
const { requireSupabaseUser } = require('../authMiddleware');
const feedbackController = require('../controllers/feedbackController');

const router = express.Router();

// All feedback routes require authentication
router.use(requireSupabaseUser);

// POST /api/feedback - Submit new feedback
router.post('/feedback', feedbackController.createFeedback);

// GET /api/feedback - List user's own feedback
router.get('/feedback', feedbackController.listUserFeedback);

// GET /api/feedback/:feedbackId - Get specific feedback
router.get('/feedback/:feedbackId', feedbackController.getFeedback);

module.exports = router;
