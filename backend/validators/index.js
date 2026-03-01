// backend/validators/index.js

/**
 * Centralized Validation Module
 *
 * Re-exports all validation schemas and middleware for easy consumption.
 *
 * Usage:
 *   const { validate, validateQuery, validateParams, schemas } = require('../validators');
 *   router.post('/notes', validate(schemas.note.createNoteSchema), controller);
 */

// Middleware
const { validate, validateQuery, validateParams } = require('./middleware');

// Schema collections
const noteSchemas = require('./noteValidators');
const assistantSchemas = require('./assistantValidators');
const feedbackSchemas = require('./feedbackValidators');
const transcriptSchemas = require('./transcriptValidators');

module.exports = {
  // Middleware
  validate,
  validateQuery,
  validateParams,

  // Namespaced schemas for organized access
  schemas: {
    note: noteSchemas,
    assistant: assistantSchemas,
    feedback: feedbackSchemas,
    transcript: transcriptSchemas,
  },

  // Direct exports for backwards compatibility
  ...noteSchemas,
  ...assistantSchemas,
  ...feedbackSchemas,
  ...transcriptSchemas,
};
