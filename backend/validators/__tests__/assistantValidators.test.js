// backend/validators/__tests__/assistantValidators.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  lockinRequestSchema,
  chatIdParamSchema,
  createChatSessionSchema,
  listChatsQuerySchema,
  assetIdParamSchema,
} = require('../assistantValidators');

// ============================================================================
// lockinRequestSchema tests
// ============================================================================

test('lockinRequestSchema - valid explain request with selection', () => {
  const validData = {
    mode: 'explain',
    selection: 'What is React?',
    chatHistory: [],
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.mode, 'explain');
  assert.equal(result.data.selection, 'What is React?');
});

test('lockinRequestSchema - valid explain request with pageContext', () => {
  const validData = {
    mode: 'explain',
    selection: 'React hooks',
    pageContext: 'This page is about React hooks and their usage in functional components.',
    pageUrl: 'https://example.com/react-hooks',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.pageContext, validData.pageContext);
});

test('lockinRequestSchema - valid general request with chatHistory', () => {
  const validData = {
    mode: 'general',
    selection: 'Some text',
    chatHistory: [
      { role: 'user', content: 'Hi there' },
      { role: 'assistant', content: 'Hello! How can I help?' },
    ],
    newUserMessage: 'Can you explain more?',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.chatHistory.length, 2);
  assert.equal(result.data.newUserMessage, 'Can you explain more?');
});

test('lockinRequestSchema - valid follow-up with empty selection', () => {
  // Follow-up messages can have empty selection if chatHistory exists
  const validData = {
    mode: 'general',
    selection: '',
    chatHistory: [
      { role: 'user', content: 'Initial question' },
      { role: 'assistant', content: 'Initial answer' },
    ],
    newUserMessage: 'Tell me more',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('lockinRequestSchema - valid initial request with attachments only', () => {
  const validData = {
    mode: 'explain',
    selection: '',
    chatHistory: [],
    attachments: ['550e8400-e29b-41d4-a716-446655440000'],
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('lockinRequestSchema - reject initial request without selection or attachments', () => {
  const invalidData = {
    mode: 'explain',
    selection: '',
    chatHistory: [],
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
  // Should fail the refinement
  assert.ok(result.error.errors.some((e) => e.message.includes('Initial requests require')));
});

test('lockinRequestSchema - reject invalid mode', () => {
  const invalidData = {
    mode: 'invalid_mode',
    selection: 'Hello',
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
  assert.ok(result.error.errors.some((e) => e.path.includes('mode')));
});

test('lockinRequestSchema - reject selection exceeding max length', () => {
  const invalidData = {
    mode: 'explain',
    selection: 'a'.repeat(50001),
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('lockinRequestSchema - reject chatHistory exceeding 50 messages', () => {
  const invalidData = {
    mode: 'general',
    selection: 'Hello',
    chatHistory: Array(51)
      .fill(null)
      .map(() => ({ role: 'user', content: 'message' })),
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('lockinRequestSchema - reject too many attachments', () => {
  const invalidData = {
    mode: 'explain',
    selection: 'Hello',
    attachments: Array(11)
      .fill(null)
      .map(() => '550e8400-e29b-41d4-a716-446655440000'),
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('lockinRequestSchema - reject invalid attachment UUID', () => {
  const invalidData = {
    mode: 'explain',
    selection: 'Hello',
    attachments: ['not-a-uuid'],
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('lockinRequestSchema - accept optional chatId as UUID', () => {
  const validData = {
    mode: 'explain',
    selection: 'Hello',
    chatId: '550e8400-e29b-41d4-a716-446655440000',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('lockinRequestSchema - reject invalid chatId UUID', () => {
  const invalidData = {
    mode: 'explain',
    selection: 'Hello',
    chatId: 'not-a-uuid',
  };

  const result = lockinRequestSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('lockinRequestSchema - accept and lowercase language code', () => {
  const validData = {
    mode: 'explain',
    selection: 'Hello',
    language: 'EN',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.language, 'en');
});

test('lockinRequestSchema - accept courseCode', () => {
  const validData = {
    mode: 'explain',
    selection: 'Hello',
    courseCode: 'FIT2004',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.courseCode, 'FIT2004');
});

test('lockinRequestSchema - defaults for optional fields', () => {
  const validData = {
    mode: 'explain',
    selection: 'Some text',
  };

  const result = lockinRequestSchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.deepEqual(result.data.chatHistory, []);
  assert.deepEqual(result.data.attachments, []);
});

// chatIdParamSchema tests
test('chatIdParamSchema - valid UUID', () => {
  const validData = {
    chatId: '550e8400-e29b-41d4-a716-446655440000',
  };

  const result = chatIdParamSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('chatIdParamSchema - reject invalid UUID', () => {
  const invalidData = {
    chatId: 'invalid-uuid',
  };

  const result = chatIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('chatIdParamSchema - reject missing chatId', () => {
  const invalidData = {};

  const result = chatIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// createChatSessionSchema tests
test('createChatSessionSchema - valid with title', () => {
  const validData = {
    title: 'My Chat Session',
  };

  const result = createChatSessionSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createChatSessionSchema - valid with initialMessage', () => {
  const validData = {
    initialMessage: 'Hello, I need help with React.',
  };

  const result = createChatSessionSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('createChatSessionSchema - valid empty body', () => {
  const result = createChatSessionSchema.safeParse({});
  assert.equal(result.success, true);
});

test('createChatSessionSchema - reject title exceeding max length', () => {
  const invalidData = {
    title: 'a'.repeat(201),
  };

  const result = createChatSessionSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// listChatsQuerySchema tests
test('listChatsQuerySchema - valid with limit', () => {
  const validData = {
    limit: '20',
  };

  const result = listChatsQuerySchema.safeParse(validData);
  assert.equal(result.success, true);
  assert.equal(result.data.limit, 20); // Coerced to number
});

test('listChatsQuerySchema - valid with cursor', () => {
  const validData = {
    cursor: '2024-01-01T00:00:00Z',
  };

  const result = listChatsQuerySchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('listChatsQuerySchema - reject limit exceeding max', () => {
  const invalidData = {
    limit: '101',
  };

  const result = listChatsQuerySchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

test('listChatsQuerySchema - reject limit below min', () => {
  const invalidData = {
    limit: '0',
  };

  const result = listChatsQuerySchema.safeParse(invalidData);
  assert.equal(result.success, false);
});

// assetIdParamSchema tests
test('assetIdParamSchema - valid UUID', () => {
  const validData = {
    assetId: '550e8400-e29b-41d4-a716-446655440000',
  };

  const result = assetIdParamSchema.safeParse(validData);
  assert.equal(result.success, true);
});

test('assetIdParamSchema - reject invalid UUID', () => {
  const invalidData = {
    assetId: 'not-valid',
  };

  const result = assetIdParamSchema.safeParse(invalidData);
  assert.equal(result.success, false);
});
