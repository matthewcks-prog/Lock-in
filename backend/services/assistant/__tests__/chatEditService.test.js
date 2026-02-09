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
      editMessage: mock.fn(async () => makeMessage({ content: 'Updated' })),
      touchChat: mock.fn(async () => {}),
      getChatMessages: mock.fn(async () => [makeMessage()]),
    };

    service = createChatEditService({ chatRepository: mockRepo });
  });

  describe('editMessageAndTruncate', () => {
    it('validates, truncates, edits, and returns timeline', async () => {
      const result = await service.editMessageAndTruncate({
        userId: USER_ID,
        chatId: CHAT_ID,
        messageId: MSG_ID,
        newContent: 'Updated question',
      });

      assert.strictEqual(mockRepo.getChatById.mock.calls.length, 1);
      assert.strictEqual(mockRepo.getMessageById.mock.calls.length, 1);
      assert.strictEqual(mockRepo.truncateAfterMessage.mock.calls.length, 1);
      assert.strictEqual(mockRepo.editMessage.mock.calls.length, 1);
      assert.strictEqual(mockRepo.touchChat.mock.calls.length, 1);
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
    it('truncates the last assistant message and returns timeline', async () => {
      mockRepo.getChatMessages.mock.mockImplementation(async () => [
        makeMessage({ id: 'msg-u1', role: 'user', created_at: '2026-01-01T00:00:00Z' }),
        makeMessage({ id: 'msg-a1', role: 'assistant', created_at: '2026-01-01T00:01:00Z' }),
      ]);

      const result = await service.truncateForRegeneration({
        userId: USER_ID,
        chatId: CHAT_ID,
      });

      assert.strictEqual(mockRepo.truncateAfterMessage.mock.calls.length, 1);
      const truncateArgs = mockRepo.truncateAfterMessage.mock.calls[0].arguments[0];
      assert.strictEqual(truncateArgs.afterMessageId, 'msg-u1');
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

    it('throws 400 when no messages exist', async () => {
      mockRepo.getChatMessages.mock.mockImplementation(async () => []);

      await assert.rejects(
        () => service.truncateForRegeneration({ userId: USER_ID, chatId: CHAT_ID }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no messages/i);
          return true;
        },
      );
    });

    it('throws 400 when no assistant message exists', async () => {
      mockRepo.getChatMessages.mock.mockImplementation(async () => [
        makeMessage({ id: 'msg-u1', role: 'user' }),
      ]);

      await assert.rejects(
        () => service.truncateForRegeneration({ userId: USER_ID, chatId: CHAT_ID }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no assistant message/i);
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
