const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../validators/middleware');
const { generateStudySummary } = require('../controllers/study/summary');
const { generateStudySummarySchema } = require('../validators/studyValidators');

const router = express.Router();

router.post(
  '/study/summary',
  requireSupabaseUser,
  validate(generateStudySummarySchema),
  asyncHandler(generateStudySummary),
);

module.exports = router;
