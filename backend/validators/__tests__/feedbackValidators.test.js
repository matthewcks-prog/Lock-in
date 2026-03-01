// backend/validators/__tests__/feedbackValidators.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createFeedbackSchema,
  listFeedbackQuerySchema,
  feedbackIdParamSchema,
} = require('../feedbackValidators');

// ============================================================================
// createFeedbackSchema tests
// ============================================================================

test('createFeedbackSchema - valid bug feedback', () => {
  const validData = {
    type: 'bug',
    message: 'The save button is not working correctly.',
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createFeedbackSchema - valid feature request', () => {
  const validData = {
    type: 'feature',
    message: 'Please add dark mode support.',
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createFeedbackSchema - valid question type', () => {
  const validData = {
    type: 'question',
    message: 'How do I use the export feature?',
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createFeedbackSchema - valid other type', () => {
  const validData = {
    type: 'other',
    message: 'General feedback about the app.',
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createFeedbackSchema - valid with context', () => {
  const validData = {
    type: 'bug',
    message: 'UI glitch on this page.',
    context: {
      url: 'https://example.com/page',
      courseCode: 'FIT2004',
      extensionVersion: '1.2.3',
      browser: 'Chrome 120',
      page: 'Notes Editor',
    },
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.context.url, 'https://example.com/page');
  assert.equal(result.data.context.courseCode, 'FIT2004');
});

test('createFeedbackSchema - valid with partial context', () => {
  const validData = {
    type: 'feature',
    message: 'Add more themes.',
    context: {
      extensionVersion: '1.2.3',
    },
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createFeedbackSchema - valid with null context', () => {
  const validData = {
    type: 'bug',
    message: 'Something is broken.',
    context: null,
  };

  const result = createFeedbackSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createFeedbackSchema - reject invalid type', () => {
  const invalidData = {
    type: 'invalid_type',
    message: 'Some feedback',
  };

  const result = createFeedbackSchema.safeParse(invalidData);
  assert.equal(result.success, false);
  assert.ok(result.error.errors.some((e) => e.path.includes('type')));
});

test('createFeedbackSchema - reject improvement type (not in valid types)', () => {
  const invalidData = {
    type: 'improvement',
    message: 'UI could be better.',
  };

  const result = createFeedbackSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createFeedbackSchema - reject missing message', () => {
  const invalidData = {
    type: 'bug',
  };

  const result = createFeedbackSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createFeedbackSchema - reject empty message', () => {
  const invalidData = {
    type: 'bug',
    message: '',
  };

  const result = createFeedbackSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createFeedbackSchema - reject message exceeding max length', () => {
  const invalidData = {
    type: 'bug',
    message: 'a'.repeat(5001),
  };

  const result = createFeedbackSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('createFeedbackSchema - reject invalid context url', () => {
  const invalidData = {
    type: 'bug',
    message: 'Something is broken.',
    context: {
      url: 'not-a-valid-url',
    },
  };

  const result = createFeedbackSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// ============================================================================
// listFeedbackQuerySchema tests
// ============================================================================

test('listFeedbackQuerySchema - valid with limit', () => {
  const validData = {
    limit: '25',
  };

  const result = listFeedbackQuerySchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.limit, 25);
});

test('listFeedbackQuerySchema - valid empty query', () => {
  const result = listFeedbackQuerySchema.safeParse({});
  assert.equal(result.success, true);
});

test('listFeedbackQuerySchema - reject limit exceeding max', () => {
  const invalidData = {
    limit: '101',
  };

  const result = listFeedbackQuerySchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// ============================================================================
// feedbackIdParamSchema tests
// ============================================================================

test('feedbackIdParamSchema - valid UUID', () => {
  const validData = {
    feedbackId: '550e8400-e29b-41d4-a716-446655440000',
  };

  const result = feedbackIdParamSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('feedbackIdParamSchema - reject invalid UUID', () => {
  const invalidData = {
    feedbackId: 'not-a-valid-uuid',
  };

  const result = feedbackIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('feedbackIdParamSchema - reject missing feedbackId', () => {
  const invalidData = {};

  const result = feedbackIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});
