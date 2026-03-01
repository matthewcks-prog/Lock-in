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
const MAX_URL_LENGTH = 2000;
const MAX_COURSE_CODE_LENGTH = 50;
const MAX_EXTENSION_VERSION_LENGTH = 20;
const MAX_BROWSER_LENGTH = 200;
const MAX_PAGE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_FEEDBACK_LIST_LIMIT = 100;

/**
 * Context schema for feedback metadata
 * Matches FeedbackContext interface in feedbackClient.ts
 */
const feedbackContextSchema = z
  .object({
    url: z.string().url().max(MAX_URL_LENGTH).optional(),
    courseCode: z.string().max(MAX_COURSE_CODE_LENGTH).optional(),
    extensionVersion: z.string().max(MAX_EXTENSION_VERSION_LENGTH).optional(),
    browser: z.string().max(MAX_BROWSER_LENGTH).optional(),
    page: z.string().max(MAX_PAGE_LENGTH).optional(),
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
    .max(MAX_MESSAGE_LENGTH, 'Message too long (max 5,000 chars)'),
  context: feedbackContextSchema,
});

/**
 * Schema for listing feedback
 * GET /api/feedback
 */
const listFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_FEEDBACK_LIST_LIMIT).optional(),
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
