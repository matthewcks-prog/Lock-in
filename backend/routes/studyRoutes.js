const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const { validate } = require('../validators/middleware');
const { generateStudySummary } = require('../controllers/study/summary');
const { generateStudySummarySchema } = require('../validators/studyValidators');

const router = express.Router();

router.post(
  '/study/summary',
  requireSupabaseUser,
  validate(generateStudySummarySchema),
  generateStudySummary,
);

module.exports = router;
