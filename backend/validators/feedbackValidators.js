// backend/validators/feedbackValidators.js

const { z } = require('zod');

/**
 * Feedback Validation Schemas
 *
 * Declarative Zod validation for feedback-related endpoints.
 * Applied via validate() middleware in routes.
 *
 * IMPORTANT: Field names MUST match the API client contract in /api/resources/feedbackClient.ts
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

// Valid feedback types (matches service layer and client)
const VALID_FEEDBACK_TYPES = ['bug', 'feature', 'question', 'other'];

/**
 * Context schema for feedback metadata
 * Matches FeedbackContext interface in feedbackClient.ts
 */
const feedbackContextSchema = z
  .object({
    url: z.string().url().max(2000).optional(),
    courseCode: z.string().max(50).optional(),
    extensionVersion: z.string().max(20).optional(),
    browser: z.string().max(200).optional(),
    page: z.string().max(200).optional(),
  })
  .passthrough()
  .optional()
  .nullable();

/**
 * Schema for creating feedback
 * POST /api/feedback
 */
const createFeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question', 'other'], {
    errorMap: () => ({ message: `Type must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}` }),
  }),
  message: z
    .string()
    .min(1, 'Feedback message is required')
    .max(5000, 'Message too long (max 5,000 chars)'),
  context: feedbackContextSchema,
});

/**
 * Schema for listing feedback
 * GET /api/feedback
 */
const listFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Schema for feedback ID parameter
 * GET /api/feedback/:feedbackId
 */
const feedbackIdParamSchema = z.object({
  feedbackId: uuidSchema,
});

module.exports = {
  createFeedbackSchema,
  listFeedbackQuerySchema,
  feedbackIdParamSchema,
};
