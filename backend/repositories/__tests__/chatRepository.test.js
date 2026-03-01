// Test environment setup - use _DEV suffixed vars as per the environment config pattern
process.env.NODE_ENV = 'development';
process.env.SUPABASE_URL_DEV = process.env.SUPABASE_URL_DEV || 'https://example.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY_DEV =
  process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || 'service-role-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';

const test = require('node:test');
const assert = require('node:assert/strict');

const { supabase } = require('../../db/supabaseClient');
const { updateChatTitle } = require('../chatRepository');

test('updateChatTitle updates the chat row for the user', async (t) => {
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

  const result = await updateChatTitle('user-1', 'chat-123', 'Arrays intro');
  assert.equal(result.title, 'Arrays intro');

  const updateCall = calls.find((entry) => entry.step === 'update');
  assert.ok(updateCall?.payload?.updated_at, 'updated_at should be set');

  const idFilter = calls.find((entry) => entry.step === 'eq' && entry.column === 'id');
  assert.equal(idFilter?.value, 'chat-123');

  const userFilter = calls.find((entry) => entry.step === 'eq' && entry.column === 'user_id');
  assert.equal(userFilter?.value, 'user-1');
});
