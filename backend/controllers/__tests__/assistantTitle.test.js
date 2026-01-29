/**
 * Unit tests for assistant chat title generation and storage
 */

// Test environment setup - use _DEV suffixed vars as per the environment config pattern
process.env.NODE_ENV = 'development';
process.env.SUPABASE_URL_DEV = process.env.SUPABASE_URL_DEV || 'https://example.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY_DEV =
  process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || 'service-role-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildInitialChatTitle,
  extractFirstUserMessage,
  coerceGeneratedTitle,
} = require('../../utils/chatTitle');
const { updateChatTitle } = require('../../chatRepository');

test('buildInitialChatTitle creates fallback title from first user message', () => {
  const title = buildInitialChatTitle('What is an array data structure?');
  assert.ok(title.length > 0, 'Title should not be empty');
  assert.ok(title.length <= 80, 'Title should be clamped to max length');
  assert.equal(title.split(' ').length, 6, 'Title should be clamped to 6 words');
});

test('extractFirstUserMessage extracts content from chat messages', () => {
  const messages = [
    { role: 'assistant', output_text: 'Hello!' },
    { role: 'user', input_text: 'What is an array?' },
    { role: 'user', input_text: 'Second question' },
  ];

  const first = extractFirstUserMessage(messages);
  assert.equal(first, 'What is an array?', 'Should extract first user message');
});

test('coerceGeneratedTitle validates and clamps generated titles', () => {
  const longTitle = 'This is a very long title that exceeds the word limit';
  const clamped = coerceGeneratedTitle(longTitle, 'Fallback');
  assert.ok(clamped.length <= 80, 'Should clamp to max length');
  assert.equal(clamped.split(' ').length, 6, 'Should clamp to 6 words');

  const empty = coerceGeneratedTitle('', 'Custom fallback');
  assert.equal(empty, 'Custom fallback', 'Should use fallback for empty title');
});

test('updateChatTitle persists title to database', async (t) => {
  const { supabase } = require('../../supabaseClient');
  const calls = [];
  const originalFrom = supabase.from;

  t.after(() => {
    supabase.from = originalFrom;
  });

  supabase.from = (table) => {
    calls.push({ step: 'table', table });

    return {
      update(payload) {
        calls.push({ step: 'update', payload });

        const chain = {
          eq(column, value) {
            calls.push({ step: 'eq', column, value });
            return chain;
          },
          select() {
            calls.push({ step: 'select' });
            return chain;
          },
          single() {
            return Promise.resolve({
              data: {
                id: 'chat-123',
                title: payload.title,
                updated_at: payload.updated_at,
                last_message_at: '2025-01-01T00:00:00.000Z',
                created_at: '2025-01-01T00:00:00.000Z',
              },
              error: null,
            });
          },
        };

        return chain;
      },
    };
  };

  const result = await updateChatTitle('user-1', 'chat-123', 'Understanding arrays');

  assert.equal(result.title, 'Understanding arrays', 'Should return updated title');
  assert.ok(result.updated_at, 'Should update timestamp');

  const updateCall = calls.find((entry) => entry.step === 'update');
  assert.equal(updateCall?.payload?.title, 'Understanding arrays', 'Should store correct title');
});
