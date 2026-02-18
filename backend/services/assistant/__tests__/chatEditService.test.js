/**
 * Tests for Chat Edit Service
 *
 * Covers editMessageAndTruncate, truncateForRegeneration, and buildCanonicalHistory.
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('assert');
const { createChatEditService } = require('../chatEditService');

describe('createChatEditService', () => {
  let mockRepo;
  let service;

  const USER_ID = 'user-1';
  const CHAT_ID = 'chat-1';
  const MSG_ID = 'msg-1';

  function makeMessage(overrides = {}) {
    return {
      id: MSG_ID,
      role: 'user',
      input_text: 'Hello',
      output_text: null,
      created_at: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockRepo = {
      getChatById: mock.fn(async () => ({ id: CHAT_ID })),
      getMessageById: mock.fn(async () => makeMessage()),
      truncateAfterMessage: mock.fn(async () => 2),
      editMessage: mock.fn(async () => ({
        revision: makeMessage({ content: 'Updated' }),
        canonicalMessages: [makeMessage()],
        truncatedCount: 2,
      })),
      truncateForRegeneration: mock.fn(async () => ({
        canonicalMessages: [makeMessage()],
        truncatedCount: 1,
        lastUserMessageId: 'msg-u1',
      })),
      touchChat: mock.fn(async () => {}),
      getChatMessages: mock.fn(async () => [makeMessage()]),
    };

    service = createChatEditService({ chatRepository: mockRepo });
  });

  describe('editMessageAndTruncate', () => {
    it('validates, edits atomically, and returns result', async () => {
      const result = await service.editMessageAndTruncate({
        userId: USER_ID,
        chatId: CHAT_ID,
        messageId: MSG_ID,
        newContent: 'Updated question',
      });

      // Should call getChatById to verify chat exists
      assert.strictEqual(mockRepo.getChatById.mock.calls.length, 1);
      // Should call getMessageById to verify message is editable
      assert.strictEqual(mockRepo.getMessageById.mock.calls.length, 1);
      // Should call editMessage (atomic transaction)
      assert.strictEqual(mockRepo.editMessage.mock.calls.length, 1);
      // Should NOT call touchChat or truncateAfterMessage (handled by transaction)
      assert.strictEqual(result.truncatedCount, 2);
      assert.ok(Array.isArray(result.canonicalMessages));
      assert.ok(result.revision);
    });

    it('throws 404 when chat not found', async () => {
      mockRepo.getChatById.mock.mockImplementation(async () => null);

      await assert.rejects(
        () =>
          service.editMessageAndTruncate({
            userId: USER_ID,
            chatId: CHAT_ID,
            messageId: MSG_ID,
            newContent: 'Updated',
          }),
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /chat not found/i);
          return true;
        },
      );
    });

    it('throws 404 when message not found', async () => {
      mockRepo.getMessageById.mock.mockImplementation(async () => null);

      await assert.rejects(
        () =>
          service.editMessageAndTruncate({
            userId: USER_ID,
            chatId: CHAT_ID,
            messageId: MSG_ID,
            newContent: 'Updated',
          }),
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.match(err.message, /message not found/i);
          return true;
        },
      );
    });

    it('throws 400 when editing an assistant message', async () => {
      mockRepo.getMessageById.mock.mockImplementation(async () =>
        makeMessage({ role: 'assistant' }),
      );

      await assert.rejects(
        () =>
          service.editMessageAndTruncate({
            userId: USER_ID,
            chatId: CHAT_ID,
            messageId: MSG_ID,
            newContent: 'Updated',
          }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /only user messages/i);
          return true;
        },
      );
    });

    it('throws when required parameters are missing', async () => {
      await assert.rejects(() => service.editMessageAndTruncate({ userId: USER_ID }), /requires/i);
    });
  });

  describe('truncateForRegeneration', () => {
    it('truncates using atomic transaction and returns result', async () => {
      // Override the mock for this specific test
      mockRepo.truncateForRegeneration.mock.mockImplementation(async () => ({
        canonicalMessages: [makeMessage({ id: 'msg-u1', role: 'user' })],
        truncatedCount: 1,
        lastUserMessageId: 'msg-u1',
      }));

      const result = await service.truncateForRegeneration({
        userId: USER_ID,
        chatId: CHAT_ID,
      });

      // Should call getChatById to verify chat exists
      assert.strictEqual(mockRepo.getChatById.mock.calls.length, 1);
      // Should call truncateForRegeneration (atomic transaction)
      assert.strictEqual(mockRepo.truncateForRegeneration.mock.calls.length, 1);
      const truncateArgs = mockRepo.truncateForRegeneration.mock.calls[0].arguments[0];
      assert.strictEqual(truncateArgs.userId, USER_ID);
      assert.strictEqual(truncateArgs.chatId, CHAT_ID);
      // Should return canonical messages and last user message
      assert.ok(Array.isArray(result.canonicalMessages));
      assert.ok(result.lastUserMessage);
      assert.strictEqual(result.lastUserMessage.id, 'msg-u1');
    });

    it('throws 404 when chat not found', async () => {
      mockRepo.getChatById.mock.mockImplementation(async () => null);

      await assert.rejects(
        () => service.truncateForRegeneration({ userId: USER_ID, chatId: CHAT_ID }),
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          return true;
        },
      );
    });

    it('throws 400 when no canonical messages returned', async () => {
      mockRepo.truncateForRegeneration.mock.mockImplementation(async () => ({
        canonicalMessages: [],
        truncatedCount: 0,
        lastUserMessageId: null,
      }));

      await assert.rejects(
        () => service.truncateForRegeneration({ userId: USER_ID, chatId: CHAT_ID }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no messages/i);
          return true;
        },
      );
    });

    it('throws 400 when no last user message found', async () => {
      mockRepo.truncateForRegeneration.mock.mockImplementation(async () => ({
        canonicalMessages: [makeMessage({ id: 'msg-a1', role: 'assistant' })],
        truncatedCount: 1,
        lastUserMessageId: null,
      }));

      await assert.rejects(
        () => service.truncateForRegeneration({ userId: USER_ID, chatId: CHAT_ID }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no user message/i);
          return true;
        },
      );
    });

    it('throws when required parameters are missing', async () => {
      await assert.rejects(() => service.truncateForRegeneration({ userId: USER_ID }), /requires/i);
    });
  });

  describe('buildCanonicalHistory', () => {
    it('maps messages to role/content pairs', () => {
      const messages = [
        { role: 'user', input_text: 'Hello', output_text: null },
        { role: 'assistant', input_text: null, output_text: 'Hi there!' },
        { role: 'user', input_text: 'Follow up', output_text: null },
      ];

      const result = service.buildCanonicalHistory(messages);

      assert.deepStrictEqual(result, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Follow up' },
      ]);
    });

    it('handles empty input_text and output_text', () => {
      const messages = [
        { role: 'user', input_text: '', output_text: null },
        { role: 'assistant', input_text: null, output_text: '' },
      ];

      const result = service.buildCanonicalHistory(messages);

      assert.deepStrictEqual(result, [
        { role: 'user', content: '' },
        { role: 'assistant', content: '' },
      ]);
    });

    it('returns empty array for empty input', () => {
      assert.deepStrictEqual(service.buildCanonicalHistory([]), []);
    });
  });
});
