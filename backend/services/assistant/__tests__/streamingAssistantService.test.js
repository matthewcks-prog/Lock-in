/**
 * Tests for Streaming Assistant Service
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('assert');
const { createStreamingAssistantService } = require('../streamingAssistantService');

describe('createStreamingAssistantService', () => {
  let mockDeps;
  let service;

  function createMockSSEWriter() {
    return {
      writeMeta: mock.fn(() => true),
      writeDelta: mock.fn(() => true),
      writeFinal: mock.fn(() => true),
      writeError: mock.fn(() => true),
      end: mock.fn(),
      isWritable: mock.fn(() => true),
    };
  }

  beforeEach(() => {
    mockDeps = {
      chatRepository: {
        getChatById: mock.fn(async () => ({ id: 'chat-123', title: 'Test Chat' })),
        createChat: mock.fn(async () => ({ id: 'new-chat-456', title: 'New chat' })), // lowercase 'c' matches FALLBACK_TITLE
        insertChatMessage: mock.fn(async () => ({ id: 'msg-789' })),
        touchChat: mock.fn(async () => {}),
      },
      rateLimitService: {
        checkDailyLimit: mock.fn(async () => ({ allowed: true, remaining: 99 })),
      },
      chatAssetsService: {
        resolveAttachmentsForMessage: mock.fn(async () => ({
          processedAttachments: [],
          linkedAssetIds: [],
          pendingAssetIds: [],
        })),
        linkAssetsToMessage: mock.fn(async () => {}),
      },
      chatTitleService: {
        generateChatTitleAsync: mock.fn(async () => {}),
      },
      idempotencyStore: {
        run: mock.fn(async (key, userId, fn) => fn()),
      },
      chatCompletionStream: mock.fn(),
      logger: {
        info: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
      },
    };

    service = createStreamingAssistantService(mockDeps);
  });

  describe('handleLockinStreamRequest', () => {
    it('writes meta event with chat and message info', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      // Mock streaming response - now returns plain text (industry standard)
      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Hello ' };
        yield { type: 'delta', content: 'World' };
        yield { type: 'final', content: 'Hello World' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test text' },
        requestId: 'req-456',
        signal,
        sseWriter,
      });

      assert.strictEqual(sseWriter.writeMeta.mock.calls.length, 1);
      const metaCall = sseWriter.writeMeta.mock.calls[0].arguments[0];
      assert.ok(metaCall.chatId);
      assert.ok(metaCall.messageId);
      assert.strictEqual(metaCall.requestId, 'req-456');
    });

    it('streams delta events from provider', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Token1 ' };
        yield { type: 'delta', content: 'Token2 ' };
        yield { type: 'delta', content: 'Token3' };
        yield { type: 'final', content: 'Token1 Token2 Token3' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test' },
        requestId: 'req-789',
        signal,
        sseWriter,
      });

      // Should have 3 delta writes
      assert.strictEqual(sseWriter.writeDelta.mock.calls.length, 3);
      assert.strictEqual(sseWriter.writeDelta.mock.calls[0].arguments[0], 'Token1 ');
      assert.strictEqual(sseWriter.writeDelta.mock.calls[1].arguments[0], 'Token2 ');
      assert.strictEqual(sseWriter.writeDelta.mock.calls[2].arguments[0], 'Token3');
    });

    it('writes final event with parsed response', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      // LLM now returns plain markdown text, not JSON
      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Here is the ' };
        yield { type: 'delta', content: 'full response ' };
        yield { type: 'delta', content: 'content.' };
        yield {
          type: 'final',
          content: 'Here is the full response content.',
          usage: { totalTokens: 100 },
        };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test' },
        requestId: 'req-101',
        signal,
        sseWriter,
      });

      assert.strictEqual(sseWriter.writeFinal.mock.calls.length, 1);
      const [content, usage] = sseWriter.writeFinal.mock.calls[0].arguments;
      assert.strictEqual(content, 'Here is the full response content.');
      assert.deepStrictEqual(usage, { totalTokens: 100 });
    });

    it('saves assistant message to database', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      // LLM now returns plain markdown text, not JSON
      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'final', content: 'Saved response content' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { chatId: 'existing-chat', selection: 'test' },
        requestId: 'req-202',
        signal,
        sseWriter,
      });

      // Should have 2 insertChatMessage calls: user message + assistant message
      assert.strictEqual(mockDeps.chatRepository.insertChatMessage.mock.calls.length, 2);

      // Check assistant message
      const assistantCall = mockDeps.chatRepository.insertChatMessage.mock.calls[1].arguments[0];
      assert.strictEqual(assistantCall.role, 'assistant');
      assert.strictEqual(assistantCall.output_text, 'Saved response content');
    });

    it('creates new chat when chatId not provided', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'final', content: 'New chat response' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'new topic' },
        requestId: 'req-303',
        signal,
        sseWriter,
      });

      assert.strictEqual(mockDeps.chatRepository.createChat.mock.calls.length, 1);
    });

    it('uses existing chat when chatId provided', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'final', content: 'Continue chat' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { chatId: 'existing-chat-id', selection: 'follow up' },
        requestId: 'req-404',
        signal,
        sseWriter,
      });

      assert.strictEqual(mockDeps.chatRepository.getChatById.mock.calls.length, 1);
      assert.strictEqual(mockDeps.chatRepository.createChat.mock.calls.length, 0);
    });

    it('throws on rate limit exceeded', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.rateLimitService.checkDailyLimit.mock.mockImplementation(async () => ({
        allowed: false,
        remaining: 0,
      }));

      await assert.rejects(
        async () => {
          await service.handleLockinStreamRequest({
            userId: 'user-123',
            payload: { selection: 'test' },
            requestId: 'req-505',
            signal,
            sseWriter,
          });
        },
        {
          message: 'Daily limit reached',
          statusCode: 429,
        },
      );
    });

    it('throws on missing user', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      await assert.rejects(
        async () => {
          await service.handleLockinStreamRequest({
            userId: null,
            payload: { selection: 'test' },
            requestId: 'req-606',
            signal,
            sseWriter,
          });
        },
        {
          message: 'User context missing for authenticated request.',
          statusCode: 500,
        },
      );
    });

    it('throws on chat not found', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatRepository.getChatById.mock.mockImplementation(async () => null);

      await assert.rejects(
        async () => {
          await service.handleLockinStreamRequest({
            userId: 'user-123',
            payload: { chatId: 'nonexistent', selection: 'test' },
            requestId: 'req-707',
            signal,
            sseWriter,
          });
        },
        {
          statusCode: 404,
        },
      );
    });

    it('stops streaming on abort signal', async () => {
      const sseWriter = createMockSSEWriter();
      const abortController = new AbortController();

      let yieldCount = 0;
      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'First ' };
        yieldCount++;
        // Simulate abort after first chunk
        abortController.abort();
        yield { type: 'delta', content: 'Second ' };
        yieldCount++;
        yield { type: 'final', content: 'First Second' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test' },
        requestId: 'req-808',
        signal: abortController.signal,
        sseWriter,
      });

      // Should have stopped after first chunk (2 yields - delta + check)
      assert.ok(yieldCount >= 1);
      // Should not have saved message (aborted)
      assert.strictEqual(mockDeps.chatRepository.insertChatMessage.mock.calls.length, 1); // Only user message
    });

    it('handles stream error from provider', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Starting...' };
        yield { type: 'error', code: 'PROVIDER_ERROR', message: 'API failed' };
      });

      await assert.rejects(
        async () => {
          await service.handleLockinStreamRequest({
            userId: 'user-123',
            payload: { selection: 'test' },
            requestId: 'req-909',
            signal,
            sseWriter,
          });
        },
        {
          message: 'API failed',
        },
      );
    });

    it('triggers title generation for new chat', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'final', content: 'Response' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'Important topic' },
        requestId: 'req-111',
        signal,
        sseWriter,
      });

      assert.strictEqual(mockDeps.chatTitleService.generateChatTitleAsync.mock.calls.length, 1);
    });

    it('handles attachments', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatAssetsService.resolveAttachmentsForMessage.mock.mockImplementation(async () => ({
        processedAttachments: [{ type: 'image', data: 'base64...' }],
        linkedAssetIds: ['asset-1', 'asset-2'],
        pendingAssetIds: [],
      }));

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'final', content: 'Image analysis' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: '', attachments: ['asset-1', 'asset-2'] },
        requestId: 'req-222',
        signal,
        sseWriter,
      });

      // Should link assets to user message
      assert.strictEqual(mockDeps.chatAssetsService.linkAssetsToMessage.mock.calls.length, 1);
    });

    it('parses non-JSON response as plain content', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      // Simulate response that isn't valid JSON
      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Plain text response without JSON' };
        yield { type: 'final', content: 'Plain text response without JSON' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test' },
        requestId: 'req-333',
        signal,
        sseWriter,
      });

      // Should still write final with the raw content
      const [content] = sseWriter.writeFinal.mock.calls[0].arguments;
      assert.strictEqual(content, 'Plain text response without JSON');
    });

    it('skips user message insertion when regenerate is true', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Regenerated response' };
        yield { type: 'final', content: 'Regenerated response' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test', chatId: 'chat-123', regenerate: true },
        requestId: 'req-regen',
        signal,
        sseWriter,
      });

      // insertChatMessage should be called only once (for the assistant message)
      // NOT twice (no user message insertion for regeneration)
      const insertCalls = mockDeps.chatRepository.insertChatMessage.mock.calls;
      assert.strictEqual(insertCalls.length, 1);
      assert.strictEqual(insertCalls[0].arguments[0].role, 'assistant');
    });

    it('inserts user message when regenerate is false or absent', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'delta', content: 'Normal response' };
        yield { type: 'final', content: 'Normal response' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: 'test' },
        requestId: 'req-normal',
        signal,
        sseWriter,
      });

      // insertChatMessage should be called twice (user + assistant)
      const insertCalls = mockDeps.chatRepository.insertChatMessage.mock.calls;
      assert.strictEqual(insertCalls.length, 2);
      assert.strictEqual(insertCalls[0].arguments[0].role, 'user');
      assert.strictEqual(insertCalls[1].arguments[0].role, 'assistant');
    });

    it('skips asset linking when regenerate is true', async () => {
      const sseWriter = createMockSSEWriter();
      const signal = new AbortController().signal;

      mockDeps.chatAssetsService.resolveAttachmentsForMessage.mock.mockImplementation(async () => ({
        processedAttachments: [{ type: 'image', data: 'base64...' }],
        linkedAssetIds: ['asset-1'],
        pendingAssetIds: [],
      }));

      mockDeps.chatCompletionStream.mock.mockImplementation(async function* () {
        yield { type: 'final', content: 'Regenerated' };
      });

      await service.handleLockinStreamRequest({
        userId: 'user-123',
        payload: { selection: '', attachments: ['asset-1'], chatId: 'chat-123', regenerate: true },
        requestId: 'req-regen-asset',
        signal,
        sseWriter,
      });

      // linkAssetsToMessage should NOT be called for regeneration
      assert.strictEqual(mockDeps.chatAssetsService.linkAssetsToMessage.mock.calls.length, 0);
    });
  });
});
