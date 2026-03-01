/**
 * Tests for Streaming Controller
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('assert');
const { createStreamController } = require('../stream');

describe('createStreamController', () => {
  let mockService;
  let mockLogger;
  let controller;

  beforeEach(() => {
    mockService = {
      handleLockinStreamRequest: mock.fn(),
    };
    mockLogger = {
      error: mock.fn(),
    };
    controller = createStreamController({
      streamingAssistantService: mockService,
      logger: mockLogger,
    });
  });

  function createMockRequest(overrides = {}) {
    const listeners = {};
    return {
      user: { id: 'user-123' },
      body: { selection: 'test selection' },
      headers: {},
      id: 'req-456',
      on: (event, handler) => {
        listeners[event] = handler;
      },
      off: mock.fn(),
      emit: (event) => {
        if (listeners[event]) listeners[event]();
      },
      ...overrides,
    };
  }

  function createMockResponse() {
    const headers = {};
    const written = [];
    return {
      writableEnded: false,
      destroyed: false,
      headersSent: false,
      setHeader: (key, value) => {
        headers[key] = value;
      },
      flushHeaders: mock.fn(),
      write: (data) => {
        written.push(data);
        return true;
      },
      flush: mock.fn(),
      end: mock.fn(() => {
        res.writableEnded = true;
      }),
      status: mock.fn(function () {
        return this;
      }),
      json: mock.fn(),
      _headers: headers,
      _written: written,
    };
  }

  // We'll just reference it for clarity
  let res;
  beforeEach(() => {
    res = createMockResponse();
  });

  describe('handleLockinStreamRequest', () => {
    it('configures SSE and calls service', async () => {
      const req = createMockRequest();
      res = createMockResponse();

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {
        // Simulate successful stream
      });

      await controller.handleLockinStreamRequest(req, res);

      // Check SSE headers were set
      assert.strictEqual(res._headers['Content-Type'], 'text/event-stream');

      // Check service was called with correct params
      const call = mockService.handleLockinStreamRequest.mock.calls[0];
      assert.strictEqual(call.arguments[0].userId, 'user-123');
      assert.deepStrictEqual(call.arguments[0].payload, {
        selection: 'test selection',
      });
      assert.ok(call.arguments[0].signal instanceof AbortSignal);
      assert.ok(call.arguments[0].sseWriter);
    });

    it('uses idempotency key from header', async () => {
      const req = createMockRequest({
        headers: { 'x-idempotency-key': 'idem-789' },
      });
      res = createMockResponse();

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {});

      await controller.handleLockinStreamRequest(req, res);

      const call = mockService.handleLockinStreamRequest.mock.calls[0];
      assert.strictEqual(call.arguments[0].idempotencyKey, 'idem-789');
    });

    it('generates request ID if not present', async () => {
      const req = createMockRequest({ id: undefined });
      res = createMockResponse();

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {});

      await controller.handleLockinStreamRequest(req, res);

      const call = mockService.handleLockinStreamRequest.mock.calls[0];
      // Should be a UUID-like string
      assert.ok(typeof call.arguments[0].requestId === 'string');
      assert.ok(call.arguments[0].requestId.length > 0);
    });

    it('writes error event on service error after headers sent', async () => {
      const req = createMockRequest();
      res = createMockResponse();
      res.headersSent = true;

      const error = new Error('Stream failed');
      error.code = 'PROVIDER_ERROR';
      error.statusCode = 500;

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {
        throw error;
      });

      await controller.handleLockinStreamRequest(req, res);

      // Should have written error event
      const errorEvent = res._written.find((w) => w.includes('event: error'));
      assert.ok(errorEvent);

      // Should have written done event
      const doneEvent = res._written.find((w) => w.includes('event: done'));
      assert.ok(doneEvent);
    });

    it('sends JSON error response if headers not sent', async () => {
      const req = createMockRequest();
      res = createMockResponse();
      res.headersSent = false;

      // Simulate error before any SSE writing
      const error = new Error('Auth failed');
      error.code = 'AUTH_ERROR';
      error.statusCode = 401;

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {
        throw error;
      });

      await controller.handleLockinStreamRequest(req, res);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Auth failed',
        },
      });
    });

    it('marks retryable for 429 and 503 errors', async () => {
      const req = createMockRequest();
      res = createMockResponse();
      res.headersSent = true;

      const error = new Error('Rate limited');
      error.statusCode = 429;

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {
        throw error;
      });

      await controller.handleLockinStreamRequest(req, res);

      const errorData = res._written.find((w) => w.includes('"retryable":true'));
      assert.ok(errorData);
    });

    it('ends stream on success', async () => {
      const req = createMockRequest();
      res = createMockResponse();

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {});

      await controller.handleLockinStreamRequest(req, res);

      // Should write done event
      const doneEvent = res._written.find((w) => w.includes('event: done'));
      assert.ok(doneEvent);
    });

    it('removes cleanup listeners on completion', async () => {
      const req = createMockRequest();
      res = createMockResponse();

      mockService.handleLockinStreamRequest.mock.mockImplementation(async () => {});

      await controller.handleLockinStreamRequest(req, res);

      // Should call req.off for cleanup
      assert.strictEqual(req.off.mock.calls.length, 2);
      assert.strictEqual(req.off.mock.calls[0].arguments[0], 'close');
      assert.strictEqual(req.off.mock.calls[1].arguments[0], 'aborted');
    });
  });
});
